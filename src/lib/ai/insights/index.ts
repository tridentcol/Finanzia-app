import 'server-only'
import { and, eq, gte, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { insights, profiles, transactions, users } from '@/lib/db/schema'
import { detectAnomalies } from './anomaly'
import { detectTrends } from './trend'
import { detectForecasts } from './forecast'
import { detectSavingsRate } from './savings-rate'
import { detectDormancy } from './dormancy'
import { detectRecurring } from './recurring-detection'
import { detectSavingsOffTrack } from './savings-off-track'
import { detectRecurringDrift } from './recurring-drift'
import { detectAntSpending } from './ant-spending'
import { generateRecommendations } from './recommendation'
import { mirrorAlertsForInsights } from './alert-mirror'
import type { DetectedInsight, InsightContext } from './types'

export type RunResult = {
  userId: string
  generated: number
  skipped: number
}

const DEDUP_WINDOW_HOURS = 24

const LOCAL_DETECTORS = [
  detectAnomalies,
  detectTrends,
  detectForecasts,
  detectSavingsRate,
  detectDormancy,
  detectRecurring,
  detectSavingsOffTrack,
  detectRecurringDrift,
  detectAntSpending,
]

/**
 * Corre los 9 detectores LOCALES (sin LLM, sin persistir) y devuelve los
 * insights detectados. Reutilizable por el cron (que luego persiste) y por el
 * copiloto heurístico (que los convierte en consejos en vivo). Cada detector
 * es tolerante a fallos: si uno revienta, no tumba al resto.
 */
export async function collectLocalInsights(
  ctx: InsightContext,
): Promise<DetectedInsight[]> {
  const detected: DetectedInsight[] = []
  for (const detector of LOCAL_DETECTORS) {
    try {
      const items = await detector(ctx)
      detected.push(...items)
    } catch (err) {
      console.error(`[insights] detector falló para ${ctx.userId}:`, err)
    }
  }
  return detected
}

/**
 * Corre los detectores para un usuario y persiste insights nuevos.
 *
 * Dedupe: dos insights con la misma `signature` (en `data.signature`) creados
 * en las últimas 24 horas se consideran duplicados — el segundo se skipea.
 * Esto permite re-ejecutar el cron varias veces al día sin spammear al usuario.
 */
export async function runDetectorsForUser(userId: string): Promise<RunResult> {
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
  })
  const ctx: InsightContext = {
    userId,
    baseCurrency: profile?.baseCurrency ?? 'COP',
    today: new Date().toISOString().slice(0, 10),
  }

  const detected: DetectedInsight[] = await collectLocalInsights(ctx)
  // Recomendación LLM: aporte separado, no bloquea si falla.
  try {
    const recs = await generateRecommendations(ctx)
    detected.push(...recs)
  } catch (err) {
    console.error(`[insights] recommendation falló para ${userId}:`, err)
  }

  if (detected.length === 0) return { userId, generated: 0, skipped: 0 }

  // Lookup de signatures ya emitidas en la ventana de dedupe.
  const signatures = detected.map((d) => d.signature)
  const existing = await db
    .select({
      sig: sql<string>`(${insights.data}->>'signature')::text`,
    })
    .from(insights)
    .where(
      and(
        eq(insights.userId, userId),
        gte(
          insights.createdAt,
          new Date(Date.now() - DEDUP_WINDOW_HOURS * 3600 * 1000),
        ),
        sql`${insights.data}->>'signature' = ANY(${signatures})`,
      ),
    )
  const existingSet = new Set(existing.map((r) => r.sig))

  const toInsert = detected
    .filter((d) => !existingSet.has(d.signature))
    .map((d) => {
      const { signature: _sig, ...rest } = d
      return {
        ...rest,
        userId,
      }
    })

  if (toInsert.length === 0) {
    return { userId, generated: 0, skipped: detected.length }
  }

  await db.insert(insights).values(toInsert)

  // Mirroring a alerts (canal de notificación). Tolerante a errores.
  try {
    await mirrorAlertsForInsights(userId, detected)
  } catch (err) {
    console.error('[insights] alert mirror falló:', err)
  }

  return {
    userId,
    generated: toInsert.length,
    skipped: detected.length - toInsert.length,
  }
}

/**
 * Lista usuarios con al menos una transacción en los últimos 60 días.
 * Los inactivos no necesitan insights nocturnos.
 */
export async function getActiveUserIds(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: transactions.userId })
    .from(transactions)
    .where(
      and(
        gte(
          transactions.date,
          new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10),
        ),
      ),
    )
  // Verificar que existan en la tabla users (defensa).
  if (rows.length === 0) return []
  const userRows = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`${users.id} = ANY(${rows.map((r) => r.userId)})`)
  return userRows.map((r) => r.id)
}
