import 'server-only'

import type { AccountSlot } from '../../intents/types'
import { listUserAccountsBasic } from '@/lib/db/queries/transactions'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { normalize } from '../normalize'
import { similarity } from '../levenshtein'

/**
 * Resuelve la cuenta aludida. Maps comunes por tipo ("mi débito"→checking,
 * "mi tarjeta"→credit_card, "ahorro"→savings) y match por nickname. Para "la
 * principal" / "mi cuenta" devuelve la de mayor saldo.
 */
const TYPE_HINTS: Array<{ re: RegExp; type: string }> = [
  { re: /\b(debito|corriente|nomina|checking)\b/, type: 'checking' },
  { re: /\b(ahorro|ahorros|savings)\b/, type: 'savings' },
  { re: /\b(tarjeta|credito|tdc|credit)\b/, type: 'credit_card' },
  { re: /\b(efectivo|cash)\b/, type: 'cash' },
]

export async function extractAccount(
  input: string,
  userId: string,
): Promise<AccountSlot | null> {
  const accounts = await listUserAccountsBasic(userId)
  if (accounts.length === 0) return null

  const n = normalize(input)

  // "la principal" / "mi cuenta" → mayor saldo.
  if (/\b(la principal|mi cuenta principal|cuenta principal)\b/.test(n)) {
    const withBalance = await listAccountsWithBalance(userId)
    const top = [...withBalance].sort(
      (a, b) => Number.parseFloat(b.currentBalance) - Number.parseFloat(a.currentBalance),
    )[0]
    if (top) return { id: top.id, name: top.name, type: top.type }
  }

  // nickname directo o fuzzy
  let best: { acc: (typeof accounts)[number]; score: number } | null = null
  for (const acc of accounts) {
    const nameNorm = normalize(acc.name)
    let score = 0
    if (nameNorm.length >= 3 && n.includes(nameNorm)) {
      score = 1
    } else {
      for (const w of n.split(' ').filter((x) => x.length >= 3)) {
        const s = similarity(nameNorm, w)
        if (s > score) score = s
      }
    }
    if (score > 0.8 && (!best || score > best.score)) best = { acc, score }
  }
  if (best) return { id: best.acc.id, name: best.acc.name, type: best.acc.type }

  // hint por tipo (única cuenta de ese tipo gana)
  for (const hint of TYPE_HINTS) {
    if (hint.re.test(n)) {
      const ofType = accounts.filter((a) => a.type === hint.type)
      if (ofType.length === 1) {
        const a = ofType[0] as (typeof accounts)[number]
        return { id: a.id, name: a.name, type: a.type }
      }
    }
  }

  return null
}
