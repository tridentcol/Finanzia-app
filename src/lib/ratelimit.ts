import 'server-only'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

import { env } from '@/lib/env'

/**
 * Rate limiter del copiloto — protege el endpoint más costoso (`/api/ai/chat`:
 * LLM + tool calls, maxDuration 60s) de bucles de abuso.
 *
 * Upstash es opcional (vars sin definir en dev local). Si falta cualquiera de
 * las dos, devolvemos `null` y el caller omite el límite en vez de fallar.
 * La instancia se memoiza a nivel de módulo.
 */
let copilotLimiter: Ratelimit | null | undefined

export function getCopilotRatelimit(): Ratelimit | null {
  if (copilotLimiter !== undefined) return copilotLimiter

  const url = env.UPSTASH_REDIS_REST_URL
  const token = env.UPSTASH_REDIS_REST_TOKEN
  if (!url || !token) {
    copilotLimiter = null
    return null
  }

  copilotLimiter = new Ratelimit({
    redis: new Redis({ url, token }),
    // Ventana deslizante: 20 turnos por minuto por usuario. Holgado para un
    // chat real, pero corta bucles automatizados.
    limiter: Ratelimit.slidingWindow(20, '60 s'),
    prefix: 'finanzia:copilot',
    analytics: false,
  })
  return copilotLimiter
}
