import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { getRecurrentesData } from '@/lib/db/queries/recurring'
import { EmptyState } from '@/components/app/empty-state'
import { NewRecurringTrigger } from '@/components/app/new-recurring-trigger'
import { RecurringList } from '@/components/app/recurring-list'
import { ProposedRecurringList } from '@/components/app/proposed-recurring-list'

export const metadata: Metadata = {
  title: 'Recurrentes',
}

export default async function RecurringPage() {
  const user = await requireCurrentUser()
  const today = new Date().toISOString().slice(0, 10)
  const { list, driftSnapshots, proposals, accountsRaw, categoriesRaw } =
    await getRecurrentesData(user.id, today)

  const editableAccounts = accountsRaw.map((a) => ({
    id: a.id,
    name: a.name,
    currency: a.currency,
  }))
  const editableCategories = categoriesRaw.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
  }))

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-text-secondary text-sm">Recurrentes</p>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Lo que se repite cada mes
          </h1>
          <p className="text-text-secondary editorial mt-2 max-w-prose text-base italic">
            Arriendo, suscripciones, salario, créditos. Estas reglas alimentan
            tu cash flow, disparan recordatorios y permiten detectar drift cuando
            un cargo llega fuera de su día habitual.
          </p>
        </div>
        <NewRecurringTrigger />
      </header>

      <ProposedRecurringList proposals={proposals} />

      {list.length === 0 ? (
        <EmptyState
          headline="No tienes reglas recurrentes."
          body="Empieza por una: lo que pagas o cobras todos los meses. Finanzia las crea solas cuando vencen — o pide tu confirmación, si lo prefieres."
          action={<NewRecurringTrigger />}
        />
      ) : (
        <RecurringList
          rules={list}
          driftSnapshots={driftSnapshots}
          accounts={editableAccounts}
          categories={editableCategories}
        />
      )}
    </div>
  )
}
