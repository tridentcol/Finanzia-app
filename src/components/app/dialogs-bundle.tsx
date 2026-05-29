import { requireCurrentUser } from '@/lib/auth'
import {
  listAvailableCategories,
  listUserAccountsBasic,
} from '@/lib/db/queries/transactions'

import { NewTransactionDialog } from './new-transaction-dialog'
import { NewCategoryDialog } from './new-category-dialog'
import { EditCategoryDialog } from './edit-category-dialog'
import { NewBudgetDialog } from './new-budget-dialog'
import { NewGoalDialog } from './new-goal-dialog'
import { NewRecurringDialog } from './new-recurring-dialog'

/**
 * Bundle de dialogs que dependen de accounts/categories del usuario.
 *
 * Aislado en su propio Server Component para envolverlo en `<Suspense>`
 * en el layout: la navegación entre rutas no espera a estas queries, los
 * dialogs entran al DOM en cuanto stream listo. La probabilidad de que el
 * usuario abra un dialog en los <200ms posteriores a una navegación es
 * baja, y `dialog-store` mantiene la intención si abre antes de que el
 * componente monte (se renderiza apenas llega el HTML).
 *
 * Los dialogs sin data dependencies (NewAccount, NewCard, NewDebt, Copilot) viven
 * directo en el layout — no tiene sentido diferirlos.
 */
export async function DialogsBundle() {
  const user = await requireCurrentUser()
  const [accountsForForm, categoriesForForm] = await Promise.all([
    listUserAccountsBasic(user.id),
    listAvailableCategories(user.id),
  ])

  return (
    <>
      <NewTransactionDialog
        accounts={accountsForForm}
        categories={categoriesForForm}
      />
      <NewCategoryDialog categories={categoriesForForm} />
      <EditCategoryDialog categories={categoriesForForm} />
      <NewBudgetDialog categories={categoriesForForm} />
      <NewGoalDialog accounts={accountsForForm} />
      <NewRecurringDialog
        accounts={accountsForForm}
        categories={categoriesForForm.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
        }))}
      />
    </>
  )
}
