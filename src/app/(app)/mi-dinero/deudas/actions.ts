'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { db } from '@/lib/db/client'
import { debts } from '@/lib/db/schema'
import { currencyCodes } from '@/lib/currency/currencies'

const debtTypeValues = [
  'loan_personal',
  'mortgage',
  'auto_loan',
  'student_loan',
  'family_loan',
  'other',
] as const

const debtStatusValues = ['active', 'paid', 'defaulted'] as const

const moneyRegex = /^\d+(\.\d{1,2})?$/

const createDebtSchema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80 caracteres'),
  lender: z.string().trim().max(80).optional().nullable(),
  type: z.enum(debtTypeValues),
  currency: z.enum(currencyCodes as [string, ...string[]]),
  principal: z.string().regex(moneyRegex, 'Formato inválido'),
  currentBalance: z.string().regex(moneyRegex, 'Formato inválido'),
  interestRate: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Formato inválido (anual %)')
    .optional()
    .nullable(),
  installmentAmount: z
    .string()
    .regex(moneyRegex, 'Formato inválido')
    .optional()
    .nullable(),
  termMonths: z.number().int().min(1).max(720).optional().nullable(),
  originDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .optional()
    .nullable(),
  nextPaymentDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida')
    .optional()
    .nullable(),
  paymentDay: z.number().int().min(1).max(31).optional().nullable(),
  linkedAccountId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(500).optional().nullable(),
})

const updateDebtSchema = createDebtSchema.partial().extend({
  id: z.string().uuid(),
  status: z.enum(debtStatusValues).optional(),
})

export type CreateDebtInput = z.input<typeof createDebtSchema>
export type UpdateDebtInput = z.input<typeof updateDebtSchema>

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | {
      ok: false
      error: { code: string; message: string; fields?: Record<string, string> }
    }

function formatErrors(parsed: z.ZodSafeParseError<unknown>): ActionResult {
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

export async function createDebt(
  input: CreateDebtInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  const parsed = createDebtSchema.safeParse(input)
  if (!parsed.success) return formatErrors(parsed) as ActionResult<{ id: string }>

  const data = parsed.data
  const [row] = await db
    .insert(debts)
    .values({
      userId: user.id,
      name: data.name,
      lender: data.lender ?? null,
      type: data.type,
      currency: data.currency,
      principal: data.principal,
      currentBalance: data.currentBalance,
      interestRate: data.interestRate ?? null,
      installmentAmount: data.installmentAmount ?? null,
      termMonths: data.termMonths ?? null,
      originDate: data.originDate ?? null,
      nextPaymentDate: data.nextPaymentDate ?? null,
      paymentDay: data.paymentDay ?? null,
      linkedAccountId: data.linkedAccountId ?? null,
      notes: data.notes ?? null,
    })
    .returning({ id: debts.id })

  if (!row) {
    return {
      ok: false,
      error: { code: 'insert_failed', message: 'No se pudo crear la deuda.' },
    }
  }

  revalidatePath('/mi-dinero/deudas')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: { id: row.id } }
}

export async function updateDebt(
  input: UpdateDebtInput,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = updateDebtSchema.safeParse(input)
  if (!parsed.success) return formatErrors(parsed)

  const { id, ...rest } = parsed.data
  const payload: Partial<typeof debts.$inferInsert> = {
    updatedAt: new Date(),
  }
  if (rest.name !== undefined) payload.name = rest.name
  if (rest.lender !== undefined) payload.lender = rest.lender
  if (rest.type !== undefined) payload.type = rest.type
  if (rest.currency !== undefined) payload.currency = rest.currency
  if (rest.principal !== undefined) payload.principal = rest.principal
  if (rest.currentBalance !== undefined)
    payload.currentBalance = rest.currentBalance
  if (rest.interestRate !== undefined) payload.interestRate = rest.interestRate
  if (rest.installmentAmount !== undefined)
    payload.installmentAmount = rest.installmentAmount
  if (rest.termMonths !== undefined) payload.termMonths = rest.termMonths
  if (rest.originDate !== undefined) payload.originDate = rest.originDate
  if (rest.nextPaymentDate !== undefined)
    payload.nextPaymentDate = rest.nextPaymentDate
  if (rest.paymentDay !== undefined) payload.paymentDay = rest.paymentDay
  if (rest.linkedAccountId !== undefined)
    payload.linkedAccountId = rest.linkedAccountId
  if (rest.notes !== undefined) payload.notes = rest.notes
  if (rest.status !== undefined) payload.status = rest.status

  await db
    .update(debts)
    .set(payload)
    .where(and(eq(debts.id, id), eq(debts.userId, user.id)))

  revalidatePath('/mi-dinero/deudas')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}

export async function archiveDebt(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  await db
    .update(debts)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(debts.id, id), eq(debts.userId, user.id)))

  revalidatePath('/mi-dinero/deudas')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}

export async function markDebtPaid(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  await db
    .update(debts)
    .set({ status: 'paid', currentBalance: '0', updatedAt: new Date() })
    .where(and(eq(debts.id, id), eq(debts.userId, user.id)))

  revalidatePath('/mi-dinero/deudas')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}
