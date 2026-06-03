import type { listRecurringForUser } from '@/lib/db/queries/recurring'

type RuleListItem = Awaited<ReturnType<typeof listRecurringForUser>>[number]

export type Breakdown = {
  entries: Array<{ label: string; total: number; description?: string }>
  max: number
  sum: number
}

/** Equivalente mensual de una regla recurrente según su frecuencia. */
function monthlyEquivalent(r: RuleListItem): number {
  const amt = Number.parseFloat(r.amount)
  switch (r.frequency) {
    case 'daily':
      return amt * 30
    case 'weekly':
      return amt * (30 / 7)
    case 'biweekly':
      return amt * 2
    case 'monthly':
      return amt
    case 'quarterly':
      return amt / 3
    case 'yearly':
      return amt / 12
  }
}

/**
 * Agrupa reglas recurrentes por categoría con su equivalente mensual, ordenado
 * desc. `fallbackToDescription`: usa la descripción individual cuando no hay
 * categoría (útil para ingresos, donde una sola regla suele ser "Salario").
 */
export function breakdownByCategory(
  rules: RuleListItem[],
  fallbackToDescription = false,
): Breakdown {
  const map = new Map<string, { label: string; total: number; description?: string }>()
  for (const r of rules) {
    const key = r.categoryName ?? (fallbackToDescription ? r.description : 'Sin categoría')
    const entry = map.get(key) ?? { label: key, total: 0 }
    entry.total += monthlyEquivalent(r)
    map.set(key, entry)
  }
  const entries = Array.from(map.values()).sort((a, b) => b.total - a.total)
  return {
    entries,
    max: Math.max(1, ...entries.map((e) => e.total)),
    sum: entries.reduce((acc, e) => acc + e.total, 0),
  }
}
