'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull, or } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { db } from '@/lib/db/client'
import { accounts, categories, recurringRules } from '@/lib/db/schema'
import { currencyCodes } from '@/lib/currency/currencies'
import { runRecurringForUser } from '@/lib/recurring/tick'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

const createSchema = z
  .object({
    description: z.string().trim().min(1).max(120),
    accountId: z.string().uuid(),
    categoryId: z.string().uuid().nullable().optional(),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
    currency: z.enum(currencyCodes as [string, ...string[]]),
    kind: z.enum(['income', 'expense']),
    frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
    dayOfMonth: z.number().int().min(1).max(31).nullable().optional(),
    dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
    nextRun: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    autoCreate: z.boolean().default(true),
  })

export type CreateRecurringInput = z.input<typeof createSchema>

export async function createRecurringRule(
  input: CreateRecurringInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  const parsed = createSchema.safeParse(input)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (key) fields[key] = issue.message
    }
    return { ok: false, error: { code: 'validation', message: 'Revisa los campos.', fields } }
  }
  const data = parsed.data

  // Inferir dayOfMonth/dayOfWeek de nextRun cuando frequency los necesita
  // y no vienen explícitos. Sin esto las reglas mensuales caen siempre el
  // 1 del mes (default usado por projectCashFlow), no en la fecha real.
  let inferredDayOfMonth = data.dayOfMonth ?? null
  let inferredDayOfWeek = data.dayOfWeek ?? null
  const needsDayOfMonth =
    data.frequency === 'monthly' ||
    data.frequency === 'quarterly' ||
    data.frequency === 'yearly'
  const needsDayOfWeek = data.frequency === 'weekly' || data.frequency === 'biweekly'
  if (needsDayOfMonth && inferredDayOfMonth === null) {
    inferredDayOfMonth = Number.parseInt(data.nextRun.slice(8, 10), 10)
  }
  if (needsDayOfWeek && inferredDayOfWeek === null) {
    inferredDayOfWeek = new Date(`${data.nextRun}T00:00:00Z`).getUTCDay()
  }

  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)),
  })
  if (!account) {
    return { ok: false, error: { code: 'invalid_account', message: 'Cuenta inválida.' } }
  }
  if (data.categoryId) {
    const cat = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.categoryId),
        eq(categories.kind, data.kind),
        or(isNull(categories.userId), eq(categories.userId, user.id)),
      ),
    })
    if (!cat) {
      return { ok: false, error: { code: 'invalid_category', message: 'Categoría inválida.' } }
    }
  }
  const [row] = await db
    .insert(recurringRules)
    .values({
      userId: user.id,
      accountId: data.accountId,
      categoryId: data.categoryId ?? null,
      description: data.description,
      amount: data.amount,
      currency: data.currency,
      kind: data.kind,
      frequency: data.frequency,
      dayOfMonth: inferredDayOfMonth,
      dayOfWeek: inferredDayOfWeek,
      nextRun: data.nextRun,
      autoCreate: data.autoCreate,
      active: true,
    })
    .returning({ id: recurringRules.id })

  if (!row) {
    return { ok: false, error: { code: 'insert_failed', message: 'No se pudo crear.' } }
  }
  revalidatePath('/mi-plan/recurrentes')
  revalidateUserData(user.id)
  return { ok: true, data: { id: row.id } }
}

// ──────────────────────────────────────────────────────────────────────
// Update recurring rule
// ──────────────────────────────────────────────────────────────────────

const updateSchema = z.object({
  id: z.string().uuid(),
  description: z.string().trim().min(1).max(120),
  accountId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  kind: z.enum(['income', 'expense']),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  nextRun: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  autoCreate: z.boolean(),
})

export type UpdateRecurringInput = z.input<typeof updateSchema>

export async function updateRecurringRule(
  input: UpdateRecurringInput,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = updateSchema.safeParse(input)
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

  const existing = await db.query.recurringRules.findFirst({
    where: and(
      eq(recurringRules.id, data.id),
      eq(recurringRules.userId, user.id),
    ),
  })
  if (!existing) {
    return { ok: false, error: { code: 'not_found', message: 'No encontrada.' } }
  }

  // Inferir dayOfMonth/dayOfWeek del nextRun como hace createRecurringRule.
  const needsDayOfMonth =
    data.frequency === 'monthly' ||
    data.frequency === 'quarterly' ||
    data.frequency === 'yearly'
  const needsDayOfWeek = data.frequency === 'weekly' || data.frequency === 'biweekly'
  const dayOfMonth = needsDayOfMonth
    ? Number.parseInt(data.nextRun.slice(8, 10), 10)
    : null
  const dayOfWeek = needsDayOfWeek
    ? new Date(`${data.nextRun}T00:00:00Z`).getUTCDay()
    : null

  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)),
  })
  if (!account) {
    return { ok: false, error: { code: 'invalid_account', message: 'Cuenta inválida.' } }
  }

  if (data.categoryId) {
    const cat = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.categoryId),
        eq(categories.kind, data.kind),
        or(isNull(categories.userId), eq(categories.userId, user.id)),
      ),
    })
    if (!cat) {
      return { ok: false, error: { code: 'invalid_category', message: 'Categoría inválida.' } }
    }
  }

  await db
    .update(recurringRules)
    .set({
      description: data.description,
      accountId: data.accountId,
      categoryId: data.categoryId ?? null,
      amount: data.amount,
      currency: account.currency,
      kind: data.kind,
      frequency: data.frequency,
      dayOfMonth,
      dayOfWeek,
      nextRun: data.nextRun,
      autoCreate: data.autoCreate,
    })
    .where(eq(recurringRules.id, data.id))

  revalidatePath('/mi-plan/recurrentes')
  revalidateUserData(user.id)
  revalidatePath('/mi-dinero/cash-flow')
  return { ok: true, data: undefined }
}

export async function toggleRecurringRule(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const row = await db.query.recurringRules.findFirst({
    where: and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)),
  })
  if (!row) return { ok: false, error: { code: 'not_found', message: 'No encontrada.' } }
  await db
    .update(recurringRules)
    .set({ active: !row.active })
    .where(eq(recurringRules.id, id))
  revalidatePath('/mi-plan/recurrentes')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}

export async function deleteRecurringRule(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  await db
    .delete(recurringRules)
    .where(and(eq(recurringRules.id, id), eq(recurringRules.userId, user.id)))
  revalidatePath('/mi-plan/recurrentes')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}

/**
 * Disparo manual del runner para el usuario actual. Útil para probar antes
 * de esperar al cron diario.
 */
export async function runRecurringNow(): Promise<
  ActionResult<{ processed: number; created: number }>
> {
  const user = await requireCurrentUser()
  const today = new Date().toISOString().slice(0, 10)
  const result = await runRecurringForUser(user.id, today)
  revalidatePath('/mi-plan/recurrentes')
  revalidateUserData(user.id)
  revalidatePath('/mi-dinero/movimientos')
  revalidatePath('/mi-dinero/cuentas')
  return { ok: true, data: result }
}
