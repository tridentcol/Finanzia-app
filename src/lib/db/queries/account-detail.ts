import 'server-only'
import { unstable_cache } from 'next/cache'

import { userDataTag } from '@/lib/cache/data'
import { getAccountById } from '@/lib/db/queries/accounts'
import {
  listAvailableCategories,
  listTransactionsForUser,
  listUserAccountsBasic,
} from '@/lib/db/queries/transactions'

/**
 * Datos de /mi-dinero/cuentas/[id]: la cuenta, sus movimientos recientes y los
 * catálogos para el menú de acciones. Si la cuenta no existe o es una tarjeta
 * (la page redirige a /mi-dinero/tarjetas/[id]) se omiten las lecturas pesadas.
 * Cacheado cross-request; el tag coarse `data:${userId}` lo bustea cualquier
 * Server Action que muta. `revalidate: 30` es un backstop.
 */
export function getCuentaDetailData(userId: string, id: string) {
  return unstable_cache(
    async () => {
      const account = await getAccountById(userId, id)
      if (!account || account.type === 'credit_card') {
        return { account, recent: [], available: [], accountsBasic: [] }
      }
      const [recent, available, accountsBasic] = await Promise.all([
        listTransactionsForUser(userId, { accountId: id, limit: 25 }),
        listAvailableCategories(userId),
        listUserAccountsBasic(userId),
      ])
      return { account, recent, available, accountsBasic }
    },
    ['cuenta-detail', userId, id],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}

/**
 * Detalle de tarjeta para /mi-dinero/tarjetas/[id]: la cuenta `credit_card` con
 * su perfil. Cacheado cross-request; el tag coarse `data:${userId}` lo bustea
 * cualquier Server Action que muta. `revalidate: 30` es un backstop.
 */
export function getCardDetailData(userId: string, id: string) {
  return unstable_cache(
    () => getAccountById(userId, id),
    ['card-detail', userId, id],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
