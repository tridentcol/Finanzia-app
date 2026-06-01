'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull, or } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { db } from '@/lib/db/client'
import { budgets, categories } from '@/lib/db/schema'

const createBudgetSchema = z.object({
  categoryId: z.string().uuid('Categoría inválida'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto positivo, ej 500000'),
  period: z.enum(['monthly', 'weekly', 'yearly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  rollover: z.boolean().optional(),
})

export type CreateBudgetInput = z.input<typeof createBudgetSchema>

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

export async function createBudget(
  input: CreateBudgetInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  const parsed = createBudgetSchema.safeParse(input)
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

  // La categoría debe ser visible (sistema o suya) y de kind=expense.
  const category = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, data.categoryId),
      or(isNull(categories.userId), eq(categories.userId, user.id)),
    ),
  })
  if (!category) {
    return {
      ok: false,
      error: { code: 'invalid_category', message: 'Categoría inválida.' },
    }
  }
  if (category.kind !== 'expense') {
    return {
      ok: false,
      error: {
        code: 'category_not_expense',
        message: 'Solo se pueden presupuestar categorías de gasto.',
      },
    }
  }

  const [row] = await db
    .insert(budgets)
    .values({
      userId: user.id,
      categoryId: data.categoryId,
      amount: data.amount,
      period: data.period,
      startDate: data.startDate,
      rollover: data.rollover ?? false,
    })
    .returning({ id: budgets.id })

  if (!row) {
    return {
      ok: false,
      error: { code: 'insert_failed', message: 'No se pudo crear el presupuesto.' },
    }
  }

  revalidatePath('/mi-plan/presupuestos')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: { id: row.id } }
}

export async function archiveBudget(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }
  await db
    .update(budgets)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(budgets.id, id), eq(budgets.userId, user.id)))
  revalidatePath('/mi-plan/presupuestos')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}
