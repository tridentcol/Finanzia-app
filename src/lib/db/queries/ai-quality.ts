import 'server-only'
import { sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { userDataTag } from '@/lib/cache/data'

export type CategorizationQuality = {
  /** Transacciones cuya categoría la sugirió la IA. */
  aiTotal: number
  /** De esas, cuántas el usuario re-categorizó (la IA se equivocó). */
  corrected: number
  /** corrected / aiTotal (0..1). */
  correctionRate: number
  /** Confianza media de las sugerencias IA (0..1). */
  avgConfidence: number | null
  /** Confianza media de las que el usuario tuvo que corregir (0..1). */
  avgConfidenceCorrected: number | null
}

/**
 * Señal de calidad de la categorización IA a partir de datos reales: qué tan
 * seguido el usuario corrige las sugerencias. Es el insumo para mover los
 * umbrales (0.85/0.60/0.55) con evidencia, no a ojo.
 */
export async function getCategorizationQuality(
  userId: string,
): Promise<CategorizationQuality> {
  const rows = await db.execute<{
    ai_total: number | string
    corrected: number | string
    avg_conf: number | string | null
    avg_conf_corrected: number | string | null
  }>(sql`
    SELECT
      count(*) FILTER (WHERE ${transactions.aiCategorized}) AS ai_total,
      count(*) FILTER (WHERE ${transactions.aiCategorized} AND ${transactions.userCorrected}) AS corrected,
      avg(${transactions.aiConfidence}) FILTER (WHERE ${transactions.aiCategorized}) AS avg_conf,
      avg(${transactions.aiConfidence}) FILTER (WHERE ${transactions.aiCategorized} AND ${transactions.userCorrected}) AS avg_conf_corrected
    FROM ${transactions}
    WHERE ${transactions.userId} = ${userId} AND ${transactions.deletedAt} IS NULL
  `)

  const r = rows[0]
  const aiTotal = Number(r?.ai_total ?? 0)
  const corrected = Number(r?.corrected ?? 0)
  return {
    aiTotal,
    corrected,
    correctionRate: aiTotal > 0 ? corrected / aiTotal : 0,
    avgConfidence: r?.avg_conf != null ? Number(r.avg_conf) : null,
    avgConfidenceCorrected: r?.avg_conf_corrected != null ? Number(r.avg_conf_corrected) : null,
  }
}

/**
 * Calidad de categorización cacheada cross-request para la sección de ajustes
 * (unstable_cache). Es una agregación sobre todas las transacciones del
 * usuario; el tag coarse `data:${userId}` lo bustea cualquier Server Action que
 * muta (toda mutación de transacciones lo hace). `revalidate: 30` es backstop.
 */
export function getCategorizationQualityCached(userId: string) {
  return unstable_cache(
    () => getCategorizationQuality(userId),
    ['categorization-quality', userId],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
