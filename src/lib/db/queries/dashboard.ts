import 'server-only'
import { unstable_cache } from 'next/cache'

import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { listTransactionsForUser } from '@/lib/db/queries/transactions'
import { listUnreadInsights } from '@/lib/db/queries/insights'
import { getDebtsSummary } from '@/lib/db/queries/debts'
import { listRecurringForUser } from '@/lib/db/queries/recurring'
import { getRatesForPairs } from '@/lib/currency/rates'
import { getDailyVolatility } from '@/lib/cash-flow/volatility'
import { userDataTag } from '@/lib/cache/data'
import type { CurrencyCode } from '@/lib/currency/currencies'

/**
 * Lecturas crudas que alimentan el dashboard, en paralelo. Solo datos de DB:
 * la lógica derivada que depende de la hora/fecha (saludo, proyección, labels
 * relativos) vive en la page, fuera del cache, para no servir nada "viejo" de
 * tiempo. Las tasas se devuelven como objeto plano (serializable; el Map se
 * reconstruye en la page).
 */
async function loadDashboardData(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
) {
  const [accountsList, recent, unreadInsights, debtsSummary, recurringRules, volatility] =
    await Promise.all([
      listAccountsWithBalance(userId),
      listTransactionsForUser(userId, { limit: 5 }),
      listUnreadInsights(userId, 1),
      getDebtsSummary(userId, baseCurrency),
      listRecurringForUser(userId),
      getDailyVolatility(userId),
    ])

  const ratePairs = accountsList
    .filter((a) => a.currency !== baseCurrency)
    .map((a) => ({ from: a.currency, to: baseCurrency }))
  const ratesObj =
    ratePairs.length > 0
      ? Object.fromEntries(await getRatesForPairs(ratePairs, today))
      : {}

  return {
    accountsList,
    recent,
    unreadInsights,
    debtsSummary,
    recurringRules,
    volatility,
    ratesObj,
  }
}

/**
 * Datos del dashboard cacheados cross-request (unstable_cache). La key incluye
 * userId/baseCurrency/today (las closure vars NO entran a la key por sí solas);
 * el tag coarse `data:${userId}` lo bustea cualquier Server Action que muta.
 * `revalidate: 30` es un backstop: peor caso, datos secundarios 30s viejos.
 */
export function getDashboardData(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
) {
  return unstable_cache(
    () => loadDashboardData(userId, baseCurrency, today),
    ['dashboard-data', userId, baseCurrency, today],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
