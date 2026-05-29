import 'server-only'

import type { MerchantSlot } from '../../intents/types'
import {
  listMerchantsForUser,
  type MerchantsRange,
  type MerchantRow,
} from '@/lib/db/queries/merchants'
import { normalize } from '../normalize'
import { similarity } from '../levenshtein'

/**
 * Resuelve el comercio aludido contra los merchants reales del usuario. Carga
 * el universo "lifetime" (todo el histórico) y hace fuzzy match con threshold
 * alto (>0.85) — los nombres de comercio son ruidosos y un falso positivo es
 * peor que no resolver.
 */
export async function extractMerchant(
  input: string,
  userId: string,
  todayIso: string,
  preloaded?: MerchantRow[],
): Promise<MerchantSlot | null> {
  const range: MerchantsRange = {
    scope: 'this-year',
    from: '2000-01-01',
    to: todayIso,
    label: 'histórico',
  }
  const merchants =
    preloaded ?? (await listMerchantsForUser(userId, range, { limit: 200 }))
  if (merchants.length === 0) return null

  const n = normalize(input)
  const words = n.split(' ').filter((w) => w.length >= 3)

  let best: { slug: string; name: string; score: number } | null = null
  for (const m of merchants) {
    const slugNorm = normalize(m.slug)
    let score = 0
    if (n.includes(slugNorm) && slugNorm.length >= 3) {
      score = 1
    } else {
      for (const w of words) {
        const s = similarity(slugNorm, w)
        if (s > score) score = s
      }
    }
    if (score > 0.85 && (!best || score > best.score)) {
      best = { slug: m.slug, name: m.name, score }
    }
  }

  return best ? { slug: best.slug, name: best.name } : null
}
