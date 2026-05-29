import 'server-only'
import { createOpenAI, type OpenAIProvider } from '@ai-sdk/openai'

import { env } from '@/lib/env'
import { getUserApiKey } from '@/lib/integrations/store'

/**
 * Cliente OpenAI lazy. Resolución de la API key en orden:
 *
 *  1. Key del usuario en Vault (`user_integrations.openai`) con scope solicitado.
 *  2. `AI_GATEWAY_API_KEY` env (operador) — apunta a Vercel AI Gateway.
 *  3. `OPENAI_API_KEY` env (operador).
 *
 * Con `scope: 'embed'` cubre embeddings (`text-embedding-3-small`, 1536 dim).
 * Con `scope: 'chat'` es el cerebro del copiloto (modelo configurable en
 * `src/lib/ai/copilot/config.ts`, default `gpt-5.4-mini`): la key del usuario
 * en Vault debe tener scope 'chat', o cae a `AI_GATEWAY_API_KEY` /
 * `OPENAI_API_KEY` del operador.
 */
const cache = new Map<string, OpenAIProvider>()

export type GetOpenAIOptions = {
  userId?: string
  scope?: 'embed' | 'chat'
}

export async function getOpenAI(
  opts: GetOpenAIOptions = {},
): Promise<OpenAIProvider | null> {
  const scope = opts.scope ?? 'embed'

  // 1. User-owned key
  if (opts.userId) {
    const userKey = await getUserApiKey({
      userId: opts.userId,
      provider: 'openai',
      requiredScope: scope,
    })
    if (userKey) return getOrCreate(`user:${opts.userId}`, userKey)
  }

  // 2. AI Gateway operador
  const gatewayKey = env.AI_GATEWAY_API_KEY
  if (gatewayKey) {
    return getOrCreate('gateway', gatewayKey, {
      baseURL: 'https://gateway.ai.vercel.com/v1/openai',
    })
  }

  // 3. OpenAI directo operador
  const opKey = env.OPENAI_API_KEY
  if (opKey) return getOrCreate('operator', opKey)

  return null
}

function getOrCreate(
  cacheKey: string,
  apiKey: string,
  extra: { baseURL?: string } = {},
): OpenAIProvider {
  const k = cacheKey + (extra.baseURL ?? '')
  const existing = cache.get(k)
  if (existing) return existing
  const created = createOpenAI({ apiKey, ...extra })
  cache.set(k, created)
  return created
}

export const EMBEDDING_MODEL = 'text-embedding-3-small'
export const EMBEDDING_DIMS = 1536
