'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { accounts, creditCardProfiles } from '@/lib/db/schema'
import { currencyCodes } from '@/lib/currency/currencies'
import { findCardProduct } from '@/lib/cards/catalog'

const cardBrandValues = ['visa', 'mastercard', 'amex', 'diners', 'other'] as const

const creditCardPaymentPolicies = ['total', 'minimum', 'partial'] as const

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

/**
 * Revalida todas las páginas que dependen del estado de tarjetas. Patrimonio
 * neto en /mi-dinero/cuentas también se afecta (activos − tarjetas − deudas),
 * por eso lo incluimos.
 */
function revalidateCardPaths(accountId?: string) {
  revalidatePath('/mi-dinero/tarjetas')
  revalidatePath('/mi-dinero/deudas')
  revalidatePath('/mi-dinero/cuentas')
  revalidatePath('/dashboard')
  if (accountId) {
    revalidatePath(`/mi-dinero/tarjetas/${accountId}`)
  }
}

// ──────────────────────────────────────────────────────────────────────
// Create card
// ──────────────────────────────────────────────────────────────────────

const createCardSchema = z
  .object({
    name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80 caracteres'),
    currency: z.enum(currencyCodes as [string, ...string[]]),
    /** Saldo a deuda en la moneda de la tarjeta. Negativo = debes.
     *  El form expone esto como positivo y lo invierte antes de enviar. */
    initialBalance: z
      .string()
      .regex(/^-?\d+(\.\d{1,2})?$/, 'Formato inválido (ej. -350000.00)'),
    creditLimit: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Formato inválido')
      .min(1, 'Requerido'),
    statementDay: z.number().int().min(1).max(31).optional().nullable(),
    paymentDay: z.number().int().min(1).max(31).optional().nullable(),
    // Identidad visual de la tarjeta (todo opcional excepto banco si elige
    // producto, que ya se valida por superRefine).
    bankSlug: z.string().min(1).max(40).optional().nullable(),
    cardProductSlug: z.string().min(1).max(60).optional().nullable(),
    cardBrand: z.enum(cardBrandValues).optional().nullable(),
    cardLastFour: z
      .string()
      .regex(/^\d{4}$/, 'Deben ser 4 dígitos')
      .optional()
      .nullable(),
    cardHolderName: z
      .string()
      .trim()
      .min(1)
      .max(60, 'Máx 60 caracteres')
      .optional()
      .nullable(),
  })
  .superRefine((val, ctx) => {
    // Si declaras producto, debe existir en el catálogo bajo el banco indicado
    // y como producto de crédito.
    if (val.bankSlug && val.cardProductSlug) {
      const found = findCardProduct(val.bankSlug, 'credit', val.cardProductSlug)
      if (!found) {
        ctx.addIssue({
          code: 'custom',
          path: ['cardProductSlug'],
          message: 'Producto no válido para este banco',
        })
      }
    }
  })

export type CreateCardInput = z.input<typeof createCardSchema>

export async function createCard(
  input: CreateCardInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()

  const parsed = createCardSchema.safeParse(input)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (key) fields[key] = issue.message
    }
    return {
      ok: false,
      error: { code: 'validation', message: 'Revisa los campos.', fields },
    }
  }

  const data = parsed.data
  const [row] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: data.name,
      type: 'credit_card',
      currency: data.currency,
      initialBalance: data.initialBalance,
      creditLimit: data.creditLimit,
      statementDay: data.statementDay ?? null,
      paymentDay: data.paymentDay ?? null,
      bankSlug: data.bankSlug ?? null,
      cardProductSlug: data.cardProductSlug ?? null,
      cardBrand: data.cardBrand ?? null,
      cardLastFour: data.cardLastFour ?? null,
      cardHolderName: data.cardHolderName ?? null,
    })
    .returning({ id: accounts.id })

  if (!row) {
    return {
      ok: false,
      error: { code: 'insert_failed', message: 'No se pudo registrar la tarjeta.' },
    }
  }

  revalidateCardPaths(row.id)
  return { ok: true, data: { id: row.id } }
}

// ──────────────────────────────────────────────────────────────────────
// Update card — datos generales (nombre, cupo, corte, pago) + identidad visual
// ──────────────────────────────────────────────────────────────────────

const updateCardSchema = z
  .object({
    accountId: z.string().uuid(),
    name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80 caracteres'),
    creditLimit: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Formato inválido')
      .min(1, 'Requerido'),
    statementDay: z.number().int().min(1).max(31).optional().nullable(),
    paymentDay: z.number().int().min(1).max(31).optional().nullable(),
    // Identidad visual — siempre se envía (puede ser null para limpiar).
    bankSlug: z.string().min(1).max(40).nullable(),
    cardProductSlug: z.string().min(1).max(60).nullable(),
    cardBrand: z.enum(cardBrandValues).nullable(),
    cardLastFour: z
      .string()
      .regex(/^\d{4}$/, 'Deben ser 4 dígitos')
      .nullable(),
    cardHolderName: z
      .string()
      .trim()
      .min(1)
      .max(60, 'Máx 60 caracteres')
      .nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.bankSlug && val.cardProductSlug) {
      const found = findCardProduct(val.bankSlug, 'credit', val.cardProductSlug)
      if (!found) {
        ctx.addIssue({
          code: 'custom',
          path: ['cardProductSlug'],
          message: 'Producto no válido para este banco',
        })
      }
    }
  })

export type UpdateCardInput = z.input<typeof updateCardSchema>

export async function updateCard(
  input: UpdateCardInput,
): Promise<ActionResult> {
  const user = await requireCurrentUser()

  const parsed = updateCardSchema.safeParse(input)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (key) fields[key] = issue.message
    }
    return {
      ok: false,
      error: { code: 'validation', message: 'Revisa los campos.', fields },
    }
  }

  const { accountId, ...data } = parsed.data

  const [acct] = await db
    .select({ id: accounts.id, type: accounts.type })
    .from(accounts)
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, user.id)))
    .limit(1)

  if (!acct || acct.type !== 'credit_card') {
    return { ok: false, error: { code: 'not_found', message: 'Tarjeta no encontrada.' } }
  }

  await db
    .update(accounts)
    .set({
      name: data.name,
      creditLimit: data.creditLimit,
      statementDay: data.statementDay ?? null,
      paymentDay: data.paymentDay ?? null,
      bankSlug: data.bankSlug,
      cardProductSlug: data.cardProductSlug,
      cardBrand: data.cardBrand,
      cardLastFour: data.cardLastFour,
      cardHolderName: data.cardHolderName,
      updatedAt: new Date(),
    })
    .where(and(eq(accounts.id, accountId), eq(accounts.userId, user.id)))

  revalidateCardPaths(accountId)
  return { ok: true, data: undefined }
}

// ──────────────────────────────────────────────────────────────────────
// Upsert credit card profile (interés, política de pago, notas)
// ──────────────────────────────────────────────────────────────────────

const upsertCreditCardProfileSchema = z.object({
  accountId: z.string().uuid(),
  allowsDirectedPayment: z.boolean().default(false),
  interestRateMonthly: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Formato inválido')
    .optional()
    .nullable(),
  paymentPolicy: z.enum(creditCardPaymentPolicies).default('total'),
  hasPromotionalTerms: z.boolean().default(false),
  notes: z.string().trim().max(500).optional().nullable(),
})

export type UpsertCreditCardProfileInput = z.input<typeof upsertCreditCardProfileSchema>

export async function upsertCreditCardProfile(
  input: UpsertCreditCardProfileInput,
): Promise<ActionResult> {
  const user = await requireCurrentUser()

  const parsed = upsertCreditCardProfileSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Datos inválidos.' } }
  }

  const data = parsed.data

  const [acct] = await db
    .select({ id: accounts.id, type: accounts.type })
    .from(accounts)
    .where(and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)))
    .limit(1)

  if (!acct || acct.type !== 'credit_card') {
    return { ok: false, error: { code: 'not_found', message: 'Tarjeta no encontrada.' } }
  }

  await db
    .insert(creditCardProfiles)
    .values({
      userId: user.id,
      accountId: data.accountId,
      allowsDirectedPayment: data.allowsDirectedPayment,
      interestRateMonthly: data.interestRateMonthly ?? null,
      paymentPolicy: data.paymentPolicy,
      hasPromotionalTerms: data.hasPromotionalTerms,
      notes: data.notes ?? null,
    })
    .onConflictDoUpdate({
      target: creditCardProfiles.accountId,
      set: {
        allowsDirectedPayment: data.allowsDirectedPayment,
        interestRateMonthly: data.interestRateMonthly ?? null,
        paymentPolicy: data.paymentPolicy,
        hasPromotionalTerms: data.hasPromotionalTerms,
        notes: data.notes ?? null,
        updatedAt: new Date(),
      },
    })

  revalidateCardPaths(data.accountId)
  return { ok: true, data: undefined }
}

// ──────────────────────────────────────────────────────────────────────
// Archive card
// ──────────────────────────────────────────────────────────────────────

export async function archiveCard(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  const [acct] = await db
    .select({ id: accounts.id, type: accounts.type })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
    .limit(1)

  if (!acct || acct.type !== 'credit_card') {
    return { ok: false, error: { code: 'not_found', message: 'Tarjeta no encontrada.' } }
  }

  await db
    .update(accounts)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))

  revalidateCardPaths(id)
  return { ok: true, data: undefined }
}
