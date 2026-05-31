'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull, or, sql } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { budgets, categories, transactions } from '@/lib/db/schema'

const kindValues = ['income', 'expense', 'transfer'] as const

const createCategorySchema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(60, 'Máx 60 caracteres'),
  kind: z.enum(kindValues),
  parentId: z.string().uuid('ID inválido').optional().nullable(),
  icon: z.string().trim().min(1).max(40).optional().nullable(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex inválido (#RRGGBB)')
    .optional()
    .nullable(),
})

export type CreateCategoryInput = z.input<typeof createCategorySchema>

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

export async function createCategory(
  input: CreateCategoryInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()

  const parsed = createCategorySchema.safeParse(input)
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

  // Si hay parent, validar que: sea visible para el usuario (sistema o propia),
  // sea del mismo kind, y no sea ella misma una subcategoría (1 nivel).
  if (data.parentId) {
    const parent = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.parentId),
        or(isNull(categories.userId), eq(categories.userId, user.id)),
      ),
    })
    if (!parent) {
      return {
        ok: false,
        error: { code: 'invalid_parent', message: 'Categoría padre inválida.' },
      }
    }
    if (parent.kind !== data.kind) {
      return {
        ok: false,
        error: {
          code: 'parent_kind_mismatch',
          message: `La categoría padre es de tipo ${parent.kind}.`,
        },
      }
    }
    if (parent.parentId !== null) {
      return {
        ok: false,
        error: {
          code: 'nested_too_deep',
          message: 'Solo se permite un nivel de jerarquía.',
        },
      }
    }
  }

  const [row] = await db
    .insert(categories)
    .values({
      userId: user.id,
      name: data.name,
      kind: data.kind,
      parentId: data.parentId ?? null,
      icon: data.icon ?? null,
      color: data.color ?? null,
    })
    .returning({ id: categories.id })

  if (!row) {
    return {
      ok: false,
      error: { code: 'insert_failed', message: 'No se pudo crear la categoría.' },
    }
  }

  revalidatePath('/categorias')
  revalidatePath('/mi-dinero/movimientos')
  revalidatePath('/mi-plan/presupuestos')
  return { ok: true, data: { id: row.id } }
}

const updateCategorySchema = z.object({
  id: z.string().uuid('ID inválido'),
  name: z.string().trim().min(1, 'Requerido').max(60, 'Máx 60 caracteres'),
  icon: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex inválido (#RRGGBB)'),
  parentId: z.string().uuid().optional().nullable(),
})

export type UpdateCategoryInput = z.input<typeof updateCategorySchema>

export async function updateCategory(
  input: UpdateCategoryInput,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = updateCategorySchema.safeParse(input)
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

  // Solo categorías custom del usuario son editables (sistema queda read-only).
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.id, data.id), eq(categories.userId, user.id)),
  })
  if (!existing) {
    return {
      ok: false,
      error: { code: 'not_found', message: 'Categoría no encontrada o no es tuya.' },
    }
  }

  // Validar el nuevo parent si se especifica.
  if (data.parentId && data.parentId !== existing.parentId) {
    if (data.parentId === existing.id) {
      return {
        ok: false,
        error: { code: 'self_parent', message: 'Una categoría no puede ser su propio padre.' },
      }
    }
    const parent = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.parentId),
        or(isNull(categories.userId), eq(categories.userId, user.id)),
      ),
    })
    if (!parent) {
      return {
        ok: false,
        error: { code: 'invalid_parent', message: 'Categoría padre inválida.' },
      }
    }
    if (parent.kind !== existing.kind) {
      return {
        ok: false,
        error: { code: 'parent_kind_mismatch', message: `Padre debe ser de tipo ${existing.kind}.` },
      }
    }
    if (parent.parentId !== null) {
      return {
        ok: false,
        error: { code: 'nested_too_deep', message: 'Solo se permite un nivel de jerarquía.' },
      }
    }
  }

  await db
    .update(categories)
    .set({
      name: data.name,
      icon: data.icon,
      color: data.color,
      parentId: data.parentId ?? null,
    })
    .where(and(eq(categories.id, data.id), eq(categories.userId, user.id)))

  revalidatePath('/categorias')
  revalidatePath('/mi-dinero/movimientos')
  revalidatePath('/mi-plan/presupuestos')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}

export async function deleteCategory(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  // Solo permitir borrar las propias.
  const existing = await db.query.categories.findFirst({
    where: and(eq(categories.id, id), eq(categories.userId, user.id)),
  })
  if (!existing) {
    return {
      ok: false,
      error: { code: 'not_found', message: 'Categoría no encontrada (las del sistema no se pueden borrar).' },
    }
  }

  // Verificar dependencias: transacciones, presupuestos, hijas. Filtramos por
  // userId también (defensa en profundidad: RLS no actúa en runtime, así que
  // no dependemos solo de que el categoryId/parentId sea del dueño).
  const [txCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(and(eq(transactions.categoryId, id), eq(transactions.userId, user.id)))
  const [budgetCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(budgets)
    .where(and(eq(budgets.categoryId, id), eq(budgets.userId, user.id)))
  const [childCountRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(categories)
    .where(and(eq(categories.parentId, id), eq(categories.userId, user.id)))

  const txCount = txCountRow?.count ?? 0
  const budgetCount = budgetCountRow?.count ?? 0
  const childCount = childCountRow?.count ?? 0

  if (txCount > 0 || budgetCount > 0 || childCount > 0) {
    const parts: string[] = []
    if (txCount > 0) parts.push(`${txCount} transacción${txCount > 1 ? 'es' : ''}`)
    if (budgetCount > 0) parts.push(`${budgetCount} presupuesto${budgetCount > 1 ? 's' : ''}`)
    if (childCount > 0) parts.push(`${childCount} subcategoría${childCount > 1 ? 's' : ''}`)
    return {
      ok: false,
      error: {
        code: 'has_dependencies',
        message: `Tiene ${parts.join(', ')}. Reasigna o archívala en su lugar.`,
      },
    }
  }

  await db
    .delete(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)))

  revalidatePath('/categorias')
  return { ok: true, data: undefined }
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  // Solo permitir archivar las propias — las sistema son read-only.
  const result = await db
    .update(categories)
    .set({ archived: true })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
    .returning({ id: categories.id })

  if (result.length === 0) {
    return {
      ok: false,
      error: {
        code: 'not_found',
        message: 'Categoría no encontrada (las del sistema no se pueden archivar).',
      },
    }
  }

  revalidatePath('/categorias')
  return { ok: true, data: undefined }
}
