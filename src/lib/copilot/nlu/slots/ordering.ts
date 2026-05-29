import type { OrderingSlot } from '../../intents/types'
import { normalize } from '../normalize'
import { extractMoney } from './money'

/**
 * Extractor de orden / límite / umbral ES. Puro.
 *  - "el más caro" / "el mayor" → desc, limit 1.
 *  - "el más barato" → asc, limit 1.
 *  - "los 3 primeros" / "top 5" → desc, limit N.
 *  - "mayor a 100k" → threshold gt; "menor a 50k" → threshold lt.
 */
const WORD_NUM: Record<string, number> = {
  un: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10,
}

export function extractOrdering(input: string): OrderingSlot | null {
  const n = normalize(input)
  const slot: OrderingSlot = { order: 'desc' }
  let found = false

  if (/\b(mas barato|menos caro|mas pequeno|menor gasto)\b/.test(n)) {
    slot.order = 'asc'
    slot.sortBy = 'amount'
    slot.limit = 1
    found = true
  } else if (/\b(mas caro|mas grande|mayor gasto|el mayor|mas costoso)\b/.test(n)) {
    slot.order = 'desc'
    slot.sortBy = 'amount'
    slot.limit = 1
    found = true
  }

  // "los 3 primeros", "top 5", "primeros 10"
  const topNum = n.match(/\b(?:top|primeros?|ultimos?)\s+(\d+)\b/) ||
    n.match(/\b(\d+)\s+(?:primeros?|mas)\b/)
  if (topNum) {
    slot.limit = Number.parseInt(topNum[1] as string, 10)
    slot.sortBy = slot.sortBy ?? 'amount'
    found = true
  } else {
    const topWord = n.match(/\b(?:top|primeros?)\s+(\w+)\b/)
    if (topWord && WORD_NUM[topWord[1] as string] !== undefined) {
      slot.limit = WORD_NUM[topWord[1] as string]
      slot.sortBy = slot.sortBy ?? 'amount'
      found = true
    }
  }

  // umbrales "mayor a 100k" / "menor a 50k" / "mas de 100000"
  const gt = n.match(/\b(?:mayor(?:es)?|mas) (?:a|de|que) /)
  const lt = n.match(/\b(?:menor(?:es)?|menos) (?:a|de|que) /)
  if (gt || lt) {
    const money = extractMoney(n)
    if (money) {
      slot.threshold = { op: gt ? 'gt' : 'lt', value: money.value }
      found = true
    }
  }

  return found ? slot : null
}
