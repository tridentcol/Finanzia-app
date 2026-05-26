import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { listAlertsForUser } from '@/lib/db/queries/alerts'
import { EmptyState } from '@/components/app/empty-state'
import { AlertList } from '@/components/app/alert-list'

export const metadata: Metadata = {
  title: 'Alertas',
}

export default async function AlertsPage() {
  const user = await requireCurrentUser()
  const list = await listAlertsForUser(user.id, { limit: 60 })

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/ajustes"
            className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors"
          >
            Ajustes
          </Link>
          <span className="text-text-tertiary text-[13px]">/</span>
          <span className="text-text-secondary text-[13px]">Alertas</span>
        </div>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.02em]">
          Notificaciones
        </h1>
        <p className="text-text-secondary editorial max-w-prose text-base italic">
          Lo que Finanzia detectó pero requiere acción tuya: gastos inusuales,
          presupuestos en riesgo, recurring por vencer.
        </p>
      </header>

      {list.length === 0 ? (
        <EmptyState
          headline="Bandeja vacía."
          body="Cuando Finanzia detecte algo accionable, lo verás aquí. El cron diario empuja anomalías y proyecciones críticas."
        />
      ) : (
        <AlertList alerts={list} />
      )}
    </div>
  )
}
