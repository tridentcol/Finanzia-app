import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { listGoalsForUser } from '@/lib/db/queries/goals'
import { EmptyState } from '@/components/app/empty-state'
import { GoalCard } from '@/components/app/goal-card'
import { NewGoalTrigger } from '@/components/app/new-goal-trigger'

export const metadata: Metadata = {
  title: 'Metas',
}

export default async function MetasPage() {
  const user = await requireCurrentUser()
  const list = await listGoalsForUser(user.id)
  const active = list.filter((g) => g.status !== 'abandoned')

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-text-secondary text-sm">Metas</p>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Hacia dónde
          </h1>
        </div>
        <NewGoalTrigger />
      </header>

      {active.length === 0 ? (
        <EmptyState
          headline="Aún no hay metas planteadas."
          body="Un fondo de emergencia, un viaje, una compra que necesita preparación. Defínela por monto y fecha; Finanzia mide la trayectoria."
          action={<NewGoalTrigger />}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {active.map((g) => (
            <li key={g.id}>
              <GoalCard goal={g} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
