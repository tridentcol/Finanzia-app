'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { accounts, goals } from '@/lib/db/schema'
import { currencyCodes } from '@/lib/currency/currencies'

const createGoalSchema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80),
  targetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido'),
  currency: z.enum(currencyCodes as [string, ...string[]]),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  linkedAccountId: z.string().uuid().optional().nullable(),
  initialAmount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional()
    .nullable(),
})

export type CreateGoalInput = z.input<typeof createGoalSchema>

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

export async function createGoal(
  input: CreateGoalInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  const parsed = createGoalSchema.safeParse(input)
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
  if (data.linkedAccountId) {
    const acc = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, data.linkedAccountId),
        eq(accounts.userId, user.id),
      ),
    })
    if (!acc) {
      return { ok: false, error: { code: 'invalid_account', message: 'Cuenta vinculada inválida.' } }
    }
  }
  const [row] = await db
    .insert(goals)
    .values({
      userId: user.id,
      name: data.name,
      targetAmount: data.targetAmount,
      currency: data.currency,
      targetDate: data.targetDate ?? null,
      linkedAccountId: data.linkedAccountId ?? null,
      currentAmount: data.initialAmount ?? '0',
      status: 'active',
    })
    .returning({ id: goals.id })

  if (!row) {
    return { ok: false, error: { code: 'insert_failed', message: 'No se pudo crear la meta.' } }
  }
  revalidatePath('/metas')
  revalidatePath('/dashboard')
  return { ok: true, data: { id: row.id } }
}

const adjustSchema = z.object({
  id: z.string().uuid(),
  delta: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
})

/**
 * Suma (o resta) un monto al `current_amount` de la meta. Usado para aportes
 * manuales. La cuenta vinculada no se modifica aquí — eso queda como ajuste
 * separado vía createTransaction.
 */
export async function adjustGoalProgress(input: {
  id: string
  delta: string
}): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = adjustSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Datos inválidos.' } }
  }
  const goal = await db.query.goals.findFirst({
    where: and(eq(goals.id, parsed.data.id), eq(goals.userId, user.id)),
  })
  if (!goal) {
    return { ok: false, error: { code: 'not_found', message: 'Meta no encontrada.' } }
  }
  const next = (
    Number.parseFloat(goal.currentAmount) + Number.parseFloat(parsed.data.delta)
  ).toFixed(2)
  const target = Number.parseFloat(goal.targetAmount)
  const status =
    Number.parseFloat(next) >= target ? 'completed' : (goal.status as 'active' | 'paused')
  await db
    .update(goals)
    .set({
      currentAmount: next,
      status,
      updatedAt: new Date(),
    })
    .where(eq(goals.id, goal.id))
  revalidatePath('/metas')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}

export async function archiveGoal(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'validation', message: 'ID inválido.' } }
  }
  await db
    .update(goals)
    .set({ status: 'abandoned', updatedAt: new Date() })
    .where(and(eq(goals.id, id), eq(goals.userId, user.id)))
  revalidatePath('/metas')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}
