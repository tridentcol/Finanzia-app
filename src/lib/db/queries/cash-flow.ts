import 'server-only'
import { unstable_cache } from 'next/cache'

import { userDataTag } from '@/lib/cache/data'
import {
  getTotalBalanceInBase,
  listAccountsWithBalance,
} from '@/lib/db/queries/accounts'
import { getDebtsSummary } from '@/lib/db/queries/debts'
import { listRecurringForUser } from '@/lib/db/queries/recurring'
import { getDailyVolatility } from '@/lib/cash-flow/volatility'
import { getRatesForPairs } from '@/lib/currency/rates'
import type { CurrencyCode } from '@/lib/currency/currencies'

/**
 * Lecturas crudas que alimentan /mi-dinero/cash-flow. Solo datos de DB: la
 * proyección a 90 días, el runway, los breakdowns y demás derivados de tiempo
 * viven en la page, fuera del cache, calculados sobre estos inputs. Las tasas
 * de las tarjetas en moneda no-base se devuelven como objeto plano
 * (serializable; el Map se reconstruye en la page).
 */
async function loadCashFlowData(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
) {
  const [rules, accountsList, volatility] = await Promise.all([
    listRecurringForUser(userId),
    listAccountsWithBalance(userId),
    getDailyVolatility(userId),
  ])

  const ownedAccounts = accountsList.filter((a) => a.type !== 'credit_card')
  const creditCards = accountsList.filter((a) => a.type === 'credit_card')

  const [assets, debtsSummary] = await Promise.all([
    getTotalBalanceInBase(userId, baseCurrency, ownedAccounts),
    getDebtsSummary(userId, baseCurrency),
  ])

  const ccNonBase = creditCards.filter((c) => c.currency !== baseCurrency)
  const ccRatesObj =
    ccNonBase.length > 0
      ? Object.fromEntries(
          await getRatesForPairs(
            ccNonBase.map((c) => ({ from: c.currency, to: baseCurrency })),
            today,
          ),
        )
      : {}

  return {
    rules,
    creditCards,
    volatility,
    assetsBase: assets.total,
    assetsPartial: assets.partial,
    debtsSummary,
    ccRatesObj,
  }
}

/**
 * Datos de /mi-dinero/cash-flow cacheados cross-request (unstable_cache). La
 * key incluye userId/baseCurrency/today (today para refrescar tasas al cambiar
 * de día); el tag coarse `data:${userId}` lo bustea cualquier Server Action que
 * muta. `revalidate: 30` es un backstop.
 */
export function getCashFlowData(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
) {
  return unstable_cache(
    () => loadCashFlowData(userId, baseCurrency, today),
    ['cash-flow-data', userId, baseCurrency, today],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
