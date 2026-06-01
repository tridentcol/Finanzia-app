'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull, or } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { budgets, categories, profiles } from '@/lib/db/schema'
import {
  COPILOT_MODEL_OPTIONS,
  getCopilotLlmConfig,
  parseCopilotOverride,
  type CopilotProvider,
} from '@/lib/ai/copilot/config'
import { listUserIntegrations } from '@/lib/integrations/store'
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
    revalidateUserData(user.id)
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
  revalidateUserData(user.id)
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
  if (env.AI_GATEWAY_API_KEY) return { mode: 'llm', source: 'gateway' }
  const operatorKey =
    provider === 'openai' ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY
  if (operatorKey) return { mode: 'llm', source: 'operator' }
  return { mode: 'heuristic', source: null }
}

export type CopilotChoice = {
  /** 'local' o `${provider}:${model}`. */
  value: string
  label: string
  kind: 'local' | 'model'
  provider?: CopilotProvider
}

/** ¿El usuario tiene un proveedor de chat disponible (Vault scope chat / env)? */
function providerAvailable(
  provider: CopilotProvider,
  integrations: Awaited<ReturnType<typeof listUserIntegrations>>,
): boolean {
  const userChat = integrations.some(
    (i) => i.provider === provider && i.status === 'active' && i.scopes.includes('chat'),
  )
  if (userChat) return true
  if (env.AI_GATEWAY_API_KEY) return true
  return Boolean(provider === 'openai' ? env.OPENAI_API_KEY : env.ANTHROPIC_API_KEY)
}

/**
 * Opciones del selector de motor del copiloto: siempre "Local", más cada modelo
 * cuyo proveedor tenga key integrada (la del usuario con scope chat, o la del
 * operador). Devuelve también la selección actual del usuario (default 'local').
 */
export async function getCopilotChoices(): Promise<{
  options: CopilotChoice[]
  current: string
}> {
  const user = await requireCurrentUser()
  const integrations = await listUserIntegrations(user.id)

  const options: CopilotChoice[] = [
    { value: 'local', label: 'Local (sin IA)', kind: 'local' },
  ]
  for (const provider of ['openai', 'anthropic'] as const) {
    if (!providerAvailable(provider, integrations)) continue
    for (const model of COPILOT_MODEL_OPTIONS[provider]) {
      options.push({ value: `${provider}:${model}`, label: model, kind: 'model', provider })
    }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
    columns: { aiProfile: true },
  })
  const override = parseCopilotOverride(
    (profile?.aiProfile as { copilot?: unknown } | null)?.copilot,
  )
  let current = 'local'
  if (override?.routing === 'llm' && override.provider && override.model) {
    const value = `${override.provider}:${override.model}`
    // Solo si el modelo guardado sigue disponible; si no, cae a local.
    if (options.some((o) => o.value === value)) current = value
  }

  return { options, current }
}

/**
 * Marca que el usuario ya vio la intro de tono del copiloto (el sheet "Cómo te
 * habla"). Se setea al cerrar el sheet la primera vez para no auto-abrirlo de
 * nuevo. Atómico (transacción + FOR UPDATE) para no pisar otras subclaves de
 * `aiProfile.copilot` (p. ej. el motor elegido). No muta datos del usuario.
 */
export async function markCopilotToneIntroSeen(): Promise<ActionResult> {
  const user = await requireCurrentUser()
  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ aiProfile: profiles.aiProfile })
        .from(profiles)
        .where(eq(profiles.userId, user.id))
        .for('update')
      const base = (row?.aiProfile as Record<string, unknown> | null) ?? {}
      const prev = (base.copilot as Record<string, unknown> | null) ?? {}
      await tx
        .update(profiles)
        .set({
          aiProfile: { ...base, copilot: { ...prev, toneIntroSeen: true } },
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, user.id))
    })
  } catch {
    return { ok: false, error: { code: 'db_error', message: 'No se pudo guardar.' } }
  }
  // Busta el router cache del cliente para /copilot: sin esto, la próxima
  // navegación serviría el RSC previo (toneIntroSeen=false) y re-abriría.
  revalidatePath('/copilot')
  return { ok: true, data: undefined }
}

const engineSchema = z.string().min(1).max(80)

/**
 * Persiste el motor elegido por el usuario en `profiles.aiProfile.copilot`:
 * 'local' (sin IA) o `${provider}:${model}` (fuerza ese modelo). Atómico
 * (transacción + FOR UPDATE) para no pisar otras subclaves de aiProfile.
 */
export async function setCopilotEngine(value: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = engineSchema.safeParse(value)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Selección inválida.' } }
  }

  let routing: 'local' | 'llm' = 'local'
  let provider: CopilotProvider | undefined
  let model: string | undefined
  if (parsed.data !== 'local') {
    const [p, m] = parsed.data.split(':')
    if ((p === 'openai' || p === 'anthropic') && m && COPILOT_MODEL_OPTIONS[p].includes(m)) {
      routing = 'llm'
      provider = p
      model = m
    } else {
      return { ok: false, error: { code: 'validation', message: 'Modelo no disponible.' } }
    }
  }

  try {
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ aiProfile: profiles.aiProfile })
        .from(profiles)
        .where(eq(profiles.userId, user.id))
        .for('update')
      const base = (row?.aiProfile as Record<string, unknown> | null) ?? {}
      const prev = (base.copilot as Record<string, unknown> | null) ?? {}
      let copilot: Record<string, unknown>
      if (routing === 'local') {
        copilot = { ...prev, routing: 'local' }
        delete copilot.provider
        delete copilot.model
      } else {
        copilot = { ...prev, routing: 'llm', provider, model }
      }
      await tx
        .update(profiles)
        .set({ aiProfile: { ...base, copilot }, updatedAt: new Date() })
        .where(eq(profiles.userId, user.id))
    })
  } catch {
    return { ok: false, error: { code: 'db_error', message: 'No se pudo guardar.' } }
  }

  return { ok: true, data: undefined }
}
