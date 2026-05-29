import 'server-only'
import { and, eq, gte, isNotNull, isNull, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'

/**
 * Devuelve σ (desviación estándar) del net delta diario de las últimas
 * `windowDays` transacciones NO recurrentes, expresado en moneda base. Esto
 * representa la "volatilidad discrecional" — gasto irregular que no está
 * capturado en `recurring_rules` y por tanto no aparece en la proyección
 * determinística. Lo usa el proyector de cash flow para dibujar bandas de
 * incertidumbre alrededor de la línea esperada.
 *
 * Si no hay suficientes datos (< 7 días con movimientos), retorna 0 — el
 * caller decide si renderizar bandas o no.
 */
export async function getDailyVolatility(
  userId: string,
  options: { windowDays?: number } = {},
): Promise<number> {
  const windowDays = options.windowDays ?? 90
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - windowDays)
  const cutoffStr = cutoff.toISOString().slice(0, 10)

  // Net daily delta de transacciones NO recurrentes (las recurrentes ya viven
  // en el modelo determinístico). Transferencias se excluyen porque son
  // neutras al patrimonio total.
  const rows = await db
    .select({
      net: sql<string>`SUM(
        CASE
          WHEN ${transactions.kind} = 'income' THEN ${transactions.amountBase}
          WHEN ${transactions.kind} = 'expense' THEN -${transactions.amountBase}
          ELSE 0
        END
      )`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        isNull(transactions.recurringRuleId),
        gte(transactions.date, cutoffStr),
        isNotNull(transactions.amountBase),
      ),
    )
    .groupBy(transactions.date)

  if (rows.length < 7) return 0

  const values = rows.map((r) => Number.parseFloat(r.net))
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const variance =
    values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / values.length
  return Math.sqrt(variance)
}
