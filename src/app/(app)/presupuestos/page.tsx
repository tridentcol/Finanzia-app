import type { Metadata } from 'next'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { listBudgetsWithProgress } from '@/lib/db/queries/budgets'
import { EmptyState } from '@/components/app/empty-state'
import { BudgetProgressCard } from '@/components/app/budget-progress'
import { NewBudgetTrigger } from '@/components/app/new-budget-trigger'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Presupuestos',
}

export default async function PresupuestosPage() {
  const user = await requireCurrentUser()
  const [profile, budgets] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
    listBudgetsWithProgress(user.id),
  ])
  const currency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-text-secondary text-sm">Presupuestos</p>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Topes por categoría
          </h1>
        </div>
        <NewBudgetTrigger />
      </header>

      {budgets.length === 0 ? (
        <EmptyState
          headline="No has definido presupuestos."
          body="Asigna un tope mensual a cualquier categoría de gasto. Finanzia te avisa cuando estés cerca del límite y cuando lo excedas — sin sermones."
          action={<NewBudgetTrigger />}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {budgets.map((b) => (
            <li key={b.id}>
              <BudgetProgressCard budget={b} currency={currency} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
