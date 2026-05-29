import 'server-only'
import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type LanguageModel,
  type UIMessage,
} from 'ai'

import { getAnthropic } from '../anthropic'
import { getOpenAI } from '../openai'
import { getCopilotLlmConfig, type CopilotLlmConfig } from './config'
import { buildCopilotTools } from './tools'
import { buildSystemPrompt } from './system-prompt'
import { buildProfileSnapshot } from './profile-snapshot'
import type { CopilotContext } from './context'

export type RunChatParams = {
  ctx: CopilotContext
  messages: UIMessage[]
  /** Provider ya resuelto (evita doble lookup al Vault). Si falta, se resuelve. */
  resolved?: ResolvedCopilotProvider
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onFinish?: (event: any) => void | Promise<void>
}

export type ResolvedCopilotProvider = {
  kind: CopilotLlmConfig['provider']
  model: LanguageModel
  config: CopilotLlmConfig
}

/**
 * Resuelve el modelo del copiloto según `COPILOT_LLM_PROVIDER`:
 *  - openai   → `getOpenAI({ scope: 'chat' })` (key del usuario en Vault →
 *               AI_GATEWAY_API_KEY → OPENAI_API_KEY). Default gpt-5.4-mini.
 *  - anthropic → `getAnthropic()`. Default claude-sonnet-4-6.
 *
 * Devuelve null si no hay key para el proveedor elegido — el caller degrada a
 * local/fallback. Exportado para que el route haga el gating con la MISMA
 * resolución y se la pase de vuelta a `runCopilotChat`.
 */
export async function resolveCopilotProvider(
  userId: string,
): Promise<ResolvedCopilotProvider | null> {
  const config = getCopilotLlmConfig()

  if (config.provider === 'openai') {
    const provider = await getOpenAI({ userId, scope: 'chat' })
    if (!provider) return null
    return { kind: 'openai', model: provider(config.model), config }
  }

  const provider = await getAnthropic({ userId })
  if (!provider) return null
  return { kind: 'anthropic', model: provider(config.model), config }
}

/**
 * Construye y dispara el streaming del copiloto sobre el LLM configurado.
 * Devuelve null si no hay provider del tipo elegido — el caller decide cómo
 * responder (local/fallback).
 *
 * Modelos de razonamiento (familia gpt-5): la asertividad se controla con
 * `reasoningEffort` + `textVerbosity` vía `providerOptions.openai`; NO se setea
 * `temperature`. `store:false` por defecto (privacidad de datos financieros).
 *
 * `stopWhen` limita los pasos del LLM a 8 — suficiente para encadenar varios
 * tools de lectura (balance + presupuestos + flujo + consulta) y redactar, sin
 * riesgo de loops.
 */
export async function runCopilotChat(params: RunChatParams) {
  const resolved = params.resolved ?? (await resolveCopilotProvider(params.ctx.userId))
  if (!resolved) return null

  const tools = buildCopilotTools(params.ctx)
  const todayIso = new Date().toISOString().slice(0, 10)
  const { config } = resolved

  // Snapshot del perfil para personalizar. Tolerante a fallos: si la DB falla,
  // el copiloto sigue funcionando sin el bloque de contexto.
  let profileSnapshot: string | undefined
  try {
    profileSnapshot = await buildProfileSnapshot({
      userId: params.ctx.userId,
      baseCurrency: params.ctx.baseCurrency,
      todayIso,
    })
  } catch (err) {
    console.error('[copilot] profile snapshot falló:', err)
  }

  const providerOptions =
    resolved.kind === 'openai'
      ? {
          openai: {
            reasoningEffort: config.reasoningEffort,
            textVerbosity: config.textVerbosity,
            store: config.store,
          },
        }
      : undefined

  return streamText({
    model: resolved.model,
    system: buildSystemPrompt({
      baseCurrency: params.ctx.baseCurrency,
      todayIso,
      profileSnapshot,
    }),
    messages: await convertToModelMessages(params.messages),
    tools,
    stopWhen: stepCountIs(8),
    ...(providerOptions ? { providerOptions } : {}),
    onFinish: params.onFinish,
  })
}
