'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull, or } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { accounts, budgets, categories } from '@/lib/db/schema'
import { getCopilotLlmConfig } from '@/lib/ai/copilot/config'
import { createTransaction } from '@/app/(app)/mi-dinero/movimientos/actions'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

const txProposalSchema = z.object({
  kind: z.enum(['income', 'expense', 'transfer']),
  accountId: z.string().uuid(),
  transferAccountId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  currency: z.string().min(3).max(3),
  description: z.string().min(1).max(200),
  merchant: z.string().max(120).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
})

/**
 * Confirma una propuesta de transacción del copiloto. Delega en
 * `createTransaction` para mantener una sola implementación de la mutación.
 */
export async function confirmProposedTransaction(input: {
  proposal: z.input<typeof txProposalSchema>
}): Promise<ActionResult<{ id: string }>> {
  // Auth + scope validation
  await requireCurrentUser()
  const parsed = txProposalSchema.safeParse(input.proposal)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'validation', message: 'Propuesta inválida.' },
    }
  }
  const p = parsed.data
  return createTransaction({
    kind: p.kind,
    accountId: p.accountId,
    transferAccountId: p.transferAccountId ?? null,
    categoryId: p.categoryId ?? null,
    date: p.date,
    amountOriginal: p.amount,
    currency: p.currency,
    description: p.description,
    merchant: p.merchant ?? null,
    notes: p.notes ?? null,
  })
}

const budgetProposalSchema = z.object({
  mode: z.enum(['create', 'update']),
  existingBudgetId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  period: z.enum(['monthly', 'weekly', 'yearly']),
  rollover: z.boolean(),
})

/**
 * Confirma propuesta de presupuesto. Crea o actualiza según `mode`.
 */
export async function confirmProposedBudget(input: {
  proposal: z.input<typeof budgetProposalSchema>
}): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()
  const parsed = budgetProposalSchema.safeParse(input.proposal)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'validation', message: 'Propuesta inválida.' },
    }
  }
  const p = parsed.data

  // Sanity: la categoría debe ser expense y visible para el usuario.
  const cat = await db.query.categories.findFirst({
    where: and(
      eq(categories.id, p.categoryId),
      eq(categories.kind, 'expense'),
      eq(categories.archived, false),
      or(isNull(categories.userId), eq(categories.userId, user.id)),
    ),
  })
  if (!cat) {
    return {
      ok: false,
      error: { code: 'invalid_category', message: 'Categoría inválida.' },
    }
  }

  if (p.mode === 'update' && p.existingBudgetId) {
    const [row] = await db
      .update(budgets)
      .set({
        amount: p.amount,
        period: p.period,
        rollover: p.rollover,
        updatedAt: new Date(),
      })
      .where(and(eq(budgets.id, p.existingBudgetId), eq(budgets.userId, user.id)))
      .returning({ id: budgets.id })
    revalidatePath('/mi-plan/presupuestos')
    revalidatePath('/dashboard')
    if (!row) {
      return {
        ok: false,
        error: { code: 'update_failed', message: 'No se pudo actualizar.' },
      }
    }
    return { ok: true, data: { id: row.id } }
  }

  const startDate = new Date()
  startDate.setUTCDate(1)
  const [row] = await db
    .insert(budgets)
    .values({
      userId: user.id,
      categoryId: p.categoryId,
      amount: p.amount,
      period: p.period,
      rollover: p.rollover,
      startDate: startDate.toISOString().slice(0, 10),
    })
    .returning({ id: budgets.id })
  revalidatePath('/mi-plan/presupuestos')
  revalidatePath('/dashboard')
  if (!row) {
    return {
      ok: false,
      error: { code: 'insert_failed', message: 'No se pudo crear.' },
    }
  }
  return { ok: true, data: { id: row.id } }
}

/**
 * Sondea si el copiloto LLM está disponible para el usuario actual, según el
 * proveedor configurado (COPILOT_LLM_PROVIDER, default OpenAI).
 * Orden: integración del usuario (scope chat) → AI Gateway → env operador.
 *
 * `mode: 'llm'` significa que el endpoint puede usar el LLM configurado.
 * `mode: 'heuristic'` significa que cae al motor interno (sin LLM).
 */
export async function isCopilotAvailable(): Promise<{
  mode: 'llm' | 'heuristic'
  source: 'user' | 'gateway' | 'operator' | null
}> {
  const user = await requireCurrentUser()
  const { provider } = getCopilotLlmConfig()
  const userKey = await import('@/lib/integrations/store').then((m) =>
    m.getUserApiKey({ userId: user.id, provider, requiredScope: 'chat' }),
  )
  if (userKey) return { mode: 'llm', source: 'user' }
  if (process.env.AI_GATEWAY_API_KEY) return { mode: 'llm', source: 'gateway' }
  const operatorKey =
    provider === 'openai' ? process.env.OPENAI_API_KEY : process.env.ANTHROPIC_API_KEY
  if (operatorKey) return { mode: 'llm', source: 'operator' }
  return { mode: 'heuristic', source: null }
}
