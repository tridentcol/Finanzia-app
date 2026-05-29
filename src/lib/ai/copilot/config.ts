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
