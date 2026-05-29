import 'server-only'

import { env } from '@/lib/env'

/**
 * Configuración resuelta del cerebro LLM del copiloto. Centraliza la lectura de
 * las env `COPILOT_*` y aplica defaults en código (no en Zod) para que cambiar
 * de modelo no toque la validación de entorno.
 *
 * Decisión (plan O1): OpenAI por defecto, Anthropic como fallback explícito.
 * Los modelos de razonamiento (familia gpt-5) NO usan `temperature`; la
 * asertividad se controla con `reasoningEffort` + `textVerbosity`.
 */

export type CopilotProvider = 'openai' | 'anthropic'
export type ReasoningEffort = 'minimal' | 'low' | 'medium' | 'high'
export type TextVerbosity = 'low' | 'medium' | 'high'

export type CopilotLlmConfig = {
  provider: CopilotProvider
  model: string
  reasoningEffort: ReasoningEffort
  textVerbosity: TextVerbosity
  /** OpenAI guarda el hilo (Responses API). Default false por privacidad. */
  store: boolean
  /** Si true, el route salta el ruteo local-first y manda todo al LLM. */
  forceLLM: boolean
}

/** Modelo de prueba pedido en el plan. Configurable por env. */
export const DEFAULT_OPENAI_MODEL = 'gpt-5.4-mini'
/** Fallback sugerido si la cuenta no tiene acceso al modelo de prueba. */
export const FALLBACK_OPENAI_MODEL = 'gpt-5-mini'
export const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-6'

const EFFORTS: readonly ReasoningEffort[] = ['minimal', 'low', 'medium', 'high']
const VERBOSITIES: readonly TextVerbosity[] = ['low', 'medium', 'high']

function boolEnv(v: string | undefined): boolean {
  if (!v) return false
  const n = v.trim().toLowerCase()
  return n === '1' || n === 'true' || n === 'yes' || n === 'on'
}

function normalizeEffort(v: string | undefined): ReasoningEffort {
  const n = v?.trim().toLowerCase()
  return (EFFORTS as readonly string[]).includes(n ?? '')
    ? (n as ReasoningEffort)
    : 'medium'
}

function normalizeVerbosity(v: string | undefined): TextVerbosity {
  const n = v?.trim().toLowerCase()
  return (VERBOSITIES as readonly string[]).includes(n ?? '')
    ? (n as TextVerbosity)
    : 'low'
}

/**
 * Override por usuario (guardado en `profiles.aiProfile.copilot`). Solo cubre la
 * elección de proveedor/modelo/asertividad; `store` (privacidad) y `forceLLM`
 * (testing) quedan a nivel operador (env), no se exponen al usuario.
 */
export type CopilotUserOverride = {
  provider?: CopilotProvider
  model?: string
  reasoningEffort?: ReasoningEffort
  textVerbosity?: TextVerbosity
}

/** Modelos ofrecidos en el selector de la UI, por proveedor. */
export const COPILOT_MODEL_OPTIONS: Record<CopilotProvider, string[]> = {
  openai: ['gpt-5.4-mini', 'gpt-5-mini', 'gpt-5.4', 'gpt-5'],
  anthropic: ['claude-sonnet-4-6'],
}

/** Aplica el override del usuario sobre la config del entorno. Pura. */
export function applyUserOverride(
  base: CopilotLlmConfig,
  override: CopilotUserOverride | null | undefined,
): CopilotLlmConfig {
  if (!override) return base
  const provider = override.provider ?? base.provider
  // Si cambió de proveedor sin elegir modelo, usar el default del nuevo.
  const providerChanged = override.provider !== undefined && override.provider !== base.provider
  const model =
    override.model?.trim() ||
    (providerChanged
      ? provider === 'openai'
        ? DEFAULT_OPENAI_MODEL
        : DEFAULT_ANTHROPIC_MODEL
      : base.model)
  return {
    ...base,
    provider,
    model,
    reasoningEffort: override.reasoningEffort ?? base.reasoningEffort,
    textVerbosity: override.textVerbosity ?? base.textVerbosity,
  }
}

/** Parsea/valida el override leído de jsonb (datos no tipados). */
export function parseCopilotOverride(raw: unknown): CopilotUserOverride | null {
  if (typeof raw !== 'object' || raw === null) return null
  const r = raw as Record<string, unknown>
  const out: CopilotUserOverride = {}
  if (r.provider === 'openai' || r.provider === 'anthropic') out.provider = r.provider
  if (typeof r.model === 'string' && r.model.trim()) out.model = r.model.trim()
  if (
    r.reasoningEffort === 'minimal' ||
    r.reasoningEffort === 'low' ||
    r.reasoningEffort === 'medium' ||
    r.reasoningEffort === 'high'
  ) {
    out.reasoningEffort = r.reasoningEffort
  }
  if (r.textVerbosity === 'low' || r.textVerbosity === 'medium' || r.textVerbosity === 'high') {
    out.textVerbosity = r.textVerbosity
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Lee y resuelve la config del copiloto desde el entorno. Pura salvo `env`. */
export function getCopilotLlmConfig(): CopilotLlmConfig {
  const provider: CopilotProvider =
    env.COPILOT_LLM_PROVIDER?.trim().toLowerCase() === 'anthropic'
      ? 'anthropic'
      : 'openai'

  const model =
    env.COPILOT_LLM_MODEL?.trim() ||
    (provider === 'openai' ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL)

  return {
    provider,
    model,
    reasoningEffort: normalizeEffort(env.COPILOT_REASONING_EFFORT),
    textVerbosity: normalizeVerbosity(env.COPILOT_TEXT_VERBOSITY),
    store: boolEnv(env.COPILOT_STORE),
    forceLLM: boolEnv(env.COPILOT_FORCE_LLM),
  }
}
