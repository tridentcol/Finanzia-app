import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import {
  getRecurringDriftSnapshots,
  listRecurringForUser,
} from '@/lib/db/queries/recurring'
import { EmptyState } from '@/components/app/empty-state'
import { NewRecurringTrigger } from '@/components/app/new-recurring-trigger'
import { RecurringList } from '@/components/app/recurring-list'

export const metadata: Metadata = {
  title: 'Recurrentes',
}

export default async function RecurringPage() {
  const user = await requireCurrentUser()
  const list = await listRecurringForUser(user.id)
  const driftRuleIds = list
    .filter((r) => r.active && r.dayOfMonth !== null)
    .map((r) => r.id)
  const driftSnapshots = await getRecurringDriftSnapshots(user.id, driftRuleIds)

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link
            href="/ajustes"
            className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
          >
            ← Ajustes
          </Link>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Reglas recurrentes
          </h1>
          <p className="text-text-secondary editorial max-w-prose text-base italic">
            Arriendo, suscripciones, salario. Finanzia las crea sola cada vez
            que vencen. Si prefieres confirmar antes, desactiva auto-crear y
            te llega una alerta.
          </p>
        </div>
        <NewRecurringTrigger />
      </header>

      {list.length === 0 ? (
        <EmptyState
          headline="No tienes reglas recurrentes."
          body="Empieza por una: lo que pagas o cobras todos los meses."
          action={<NewRecurringTrigger />}
        />
      ) : (
        <RecurringList rules={list} driftSnapshots={driftSnapshots} />
      )}
    </div>
  )
}
