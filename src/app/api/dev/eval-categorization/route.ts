import { NextResponse } from 'next/server'
import { eq, isNull, or } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { categories } from '@/lib/db/schema'
import { categorizeTransaction } from '@/lib/ai/categorize'
import { CATEGORIZATION_GOLDEN } from '@/lib/ai/evals/categorization-golden'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Runner del golden set de categorización — mide la calidad del motor (kNN +
 * fallback LLM) con datos en vez de mover los umbrales a ciegas.
 *
 * Corre el pipeline REAL (`categorizeTransaction`) sobre el usuario autenticado
 * y su key configurada. Vive como ruta porque `src/lib/ai/*` es `server-only`
 * (no se puede importar desde un script tsx).
 *
 * SOLO dev/preview (404 en producción). Uso: con sesión iniciada en local,
 * abrir `/api/dev/eval-categorization`. Devuelve accuracy global, desglose por
 * `source` (top1/knn/llm/merchant/none) y la lista de fallos para iterar.
 */
export async function GET() {
  if (env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, error: { code: 'disabled', message: 'Eval no disponible en producción.' } },
      { status: 404 },
    )
  }

  let user
  try {
    user = await requireCurrentUser()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'No autenticado.' } },
      { status: 401 },
    )
  }

  // id -> nombre de las categorías visibles (sistema + del usuario).
  const cats = await db
    .select({ id: categories.id, name: categories.name })
    .from(categories)
    .where(or(isNull(categories.userId), eq(categories.userId, user.id)))
  const nameById = new Map(cats.map((c) => [c.id, c.name]))

  const startedAt = Date.now()
  const results: Array<{
    description: string
    expected: string
    predicted: string | null
    source: string | null
    confidence: number | null
    ok: boolean
  }> = []
  const bySource: Record<string, number> = {}
  let correct = 0

  for (const c of CATEGORIZATION_GOLDEN) {
    const sug = await categorizeTransaction({
      userId: user.id,
      description: c.description,
      merchant: c.merchant,
      kind: c.kind,
    })
    const predicted = sug ? nameById.get(sug.categoryId) ?? null : null
    const ok = predicted === c.expected
    if (ok) correct++
    const sourceKey = sug?.source ?? 'none'
    bySource[sourceKey] = (bySource[sourceKey] ?? 0) + 1
    results.push({
      description: c.description,
      expected: c.expected,
      predicted,
      source: sug?.source ?? null,
      confidence: sug ? Number(sug.confidence.toFixed(2)) : null,
      ok,
    })
  }

  const total = CATEGORIZATION_GOLDEN.length
  return NextResponse.json({
    ok: true,
    data: {
      total,
      correct,
      accuracy: total > 0 ? Number((correct / total).toFixed(3)) : 0,
      bySource,
      misses: results.filter((r) => !r.ok),
      durationMs: Date.now() - startedAt,
    },
  })
}
