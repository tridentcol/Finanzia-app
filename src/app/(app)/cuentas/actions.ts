'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { currencyCodes } from '@/lib/currency/currencies'
import { findCardProduct, type CardKind } from '@/lib/cards/catalog'

const accountTypeValues = [
  'checking',
  'savings',
  'credit_card',
  'cash',
  'investment',
  'crypto',
  'other',
] as const

const cardBrandValues = ['visa', 'mastercard', 'amex', 'diners', 'other'] as const

const createAccountSchema = z
  .object({
    name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80 caracteres'),
    type: z.enum(accountTypeValues),
    currency: z.enum(currencyCodes as [string, ...string[]]),
    initialBalance: z
      .string()
      .regex(/^-?\d+(\.\d{1,2})?$/, 'Formato inválido (ej. 1000.00)'),
    creditLimit: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Formato inválido')
      .optional()
      .nullable(),
    statementDay: z.number().int().min(1).max(31).optional().nullable(),
    paymentDay: z.number().int().min(1).max(31).optional().nullable(),
    color: z
      .string()
      .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex inválido')
      .optional()
      .nullable(),
    icon: z.string().min(1).max(40).optional().nullable(),
    // Identidad visual de la tarjeta (todo opcional).
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
    if (val.type === 'credit_card' && !val.creditLimit) {
      ctx.addIssue({
        code: 'custom',
        path: ['creditLimit'],
        message: 'Requerido para tarjeta de crédito',
      })
    }
    // Si declara identidad visual, valida que (banco, producto) exista
    // en el catálogo y sea consistente con el kind derivado del type.
    if (val.bankSlug || val.cardProductSlug) {
      const kind: CardKind | null =
        val.type === 'credit_card'
          ? 'credit'
          : val.type === 'checking' || val.type === 'savings'
            ? 'debit'
            : null
      if (!kind) {
        ctx.addIssue({
          code: 'custom',
          path: ['bankSlug'],
          message: 'Este tipo de cuenta no admite identidad visual de tarjeta',
        })
        return
      }
      if (val.bankSlug && val.cardProductSlug) {
        const found = findCardProduct(val.bankSlug, kind, val.cardProductSlug)
        if (!found) {
          ctx.addIssue({
            code: 'custom',
            path: ['cardProductSlug'],
            message: 'Producto no válido para este banco',
          })
        }
      }
    }
  })

export type CreateAccountInput = z.input<typeof createAccountSchema>

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

export async function createAccount(
  input: CreateAccountInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()

  const parsed = createAccountSchema.safeParse(input)
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
      type: data.type,
      currency: data.currency,
      initialBalance: data.initialBalance,
      creditLimit: data.type === 'credit_card' ? (data.creditLimit ?? null) : null,
      statementDay: data.type === 'credit_card' ? (data.statementDay ?? null) : null,
      paymentDay: data.type === 'credit_card' ? (data.paymentDay ?? null) : null,
      color: data.color ?? null,
      icon: data.icon ?? null,
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
      error: { code: 'insert_failed', message: 'No se pudo crear la cuenta.' },
    }
  }

  revalidatePath('/cuentas')
  revalidatePath('/dashboard')
  return { ok: true, data: { id: row.id } }
}

export async function archiveAccount(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  await db
    .update(accounts)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))

  revalidatePath('/cuentas')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}
