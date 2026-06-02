import { tool } from 'ai'
import { z } from 'zod'

import { getHealthScore } from '@/lib/db/queries/health'
import { BAND_LABEL } from '@/lib/health/score'
import type { CurrencyCode } from '@/lib/currency/currencies'
import type { CopilotContext } from '../context'

/**
 * Score de Salud Financiera (0..100) con su banda y el desglose por dimensión,
 * cada una con su "porqué". Read-only y determinista (sin LLM en el cálculo).
 * Útil para "¿cómo voy?", "¿cómo está mi salud financiera?", "¿qué debería
 * mejorar?". El copiloto usa esto para explicar el score y priorizar consejos.
 */
export function getFinancialHealthTool(ctx: CopilotContext) {
  return tool({
    description:
      'Salud financiera del usuario: un score 0..100 con su banda (Sólida/Estable/Atención/Frágil) y el desglose por dimensión (ahorro, colchón, deuda, presupuestos, estabilidad), cada una con su explicación. Determinista, cifras reales. Útil para "cómo voy", "cómo está mi salud financiera", "qué debería mejorar", "en qué estoy bien".',
    inputSchema: z.object({}),
    execute: async () => {
      const today = new Date().toISOString().slice(0, 10)
      const health = await getHealthScore(
        ctx.userId,
        ctx.baseCurrency as CurrencyCode,
        today,
      )

      return {
        score: health.score,
        band: health.band ? BAND_LABEL[health.band] : null,
        summary: health.summary,
        evaluatedCount: health.evaluatedCount,
        dimensions: health.dimensions.map((d) => ({
          dimension: d.label,
          score: d.score,
          status: d.status, // good | watch | risk | na
          available: d.available,
          detail: d.detail,
        })),
      }
    },
  })
}
