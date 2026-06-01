import 'server-only'
import { unstable_cache } from 'next/cache'

import { userDataTag } from '@/lib/cache/data'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { getRatesForPairs } from '@/lib/currency/rates'
import type { CurrencyCode } from '@/lib/currency/currencies'

/**
 * Lecturas crudas de /mi-dinero/tarjetas: las cuentas tipo `credit_card` con
 * saldo y las tasas del día para las que están en moneda no-base. Los derivados
 * de tiempo (días hasta el próximo corte) y los totales de cupo/utilización se
 * calculan en la page. Las tasas van como objeto plano (el Map se reconstruye).
 */
async function loadTarjetasData(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
) {
  const accountsList = await listAccountsWithBalance(userId)
  const cards = accountsList.filter((a) => a.type === 'credit_card')
  const nonBase = cards.filter((c) => c.currency !== baseCurrency)
  const ratesObj =
    nonBase.length > 0
      ? Object.fromEntries(
          await getRatesForPairs(
            nonBase.map((c) => ({ from: c.currency, to: baseCurrency })),
            today,
          ),
        )
      : {}
  return { cards, ratesObj }
}

/**
 * Datos de /mi-dinero/tarjetas cacheados cross-request (unstable_cache). La key
 * incluye userId/baseCurrency/today (today para refrescar tasas al cambiar de
 * día); el tag coarse `data:${userId}` lo bustea cualquier Server Action que
 * muta. `revalidate: 30` es un backstop.
 */
export function getTarjetasData(
  userId: string,
  baseCurrency: CurrencyCode,
  today: string,
) {
  return unstable_cache(
    () => loadTarjetasData(userId, baseCurrency, today),
    ['tarjetas-data', userId, baseCurrency, today],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
