import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { listUserIntegrations } from '@/lib/integrations/store'
import { countUnreadAlerts } from '@/lib/db/queries/alerts'
import { icons } from '@/lib/design/icons'

export const metadata: Metadata = {
  title: 'Ajustes',
}

export default async function AjustesPage() {
  const user = await requireCurrentUser()
  const [profile, integrations, unreadAlerts] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
    listUserIntegrations(user.id),
    countUnreadAlerts(user.id),
  ])
  const Spark = icons.sparkles
  const Bell = icons.bell

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm">Ajustes</p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.02em]">
          Tu perfil
        </h1>
      </header>

      <section className="border-border-default bg-surface flex flex-col divide-y divide-[color:var(--border-default)] rounded-[12px] border">
        <Row label="Email" value={user.email} />
        <Row label="Nombre" value={user.name ?? '—'} />
        <Row label="Moneda base" value={profile?.baseCurrency ?? '—'} mono />
        <Row label="Locale" value={profile?.locale ?? '—'} mono />
        <Row label="Zona horaria" value={profile?.timezone ?? '—'} mono />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-text text-sm font-semibold">Configuración</h2>
        <div className="flex flex-col gap-3">
          <Link
            href="/ajustes/integraciones"
            className="border-border-default bg-surface hover:bg-surface-hover/60 flex items-center justify-between gap-4 rounded-[12px] border p-5 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Spark
                strokeWidth={1.5}
                className="mt-0.5 size-4"
                style={{ color: 'var(--accent-ai)' }}
              />
              <div className="flex flex-col gap-1">
                <span className="text-text text-sm font-semibold">Integraciones IA</span>
                <span className="text-text-secondary text-[13px]">
                  {integrations.length === 0
                    ? 'Sin claves configuradas — operando en modo heurístico.'
                    : `${integrations.length} ${
                        integrations.length === 1
                          ? 'integración activa'
                          : 'integraciones activas'
                      }.`}
                </span>
              </div>
            </div>
            <span className="text-text-tertiary text-sm">→</span>
          </Link>

          <Link
            href="/ajustes/recurring"
            className="border-border-default bg-surface hover:bg-surface-hover/60 flex items-center justify-between gap-4 rounded-[12px] border p-5 transition-colors"
          >
            <div className="flex items-start gap-3">
              {(() => {
                const Repeat = icons.repeat
                return (
                  <Repeat
                    strokeWidth={1.5}
                    className="text-text-tertiary mt-0.5 size-4"
                  />
                )
              })()}
              <div className="flex flex-col gap-1">
                <span className="text-text text-sm font-semibold">
                  Reglas recurrentes
                </span>
                <span className="text-text-secondary text-[13px]">
                  Suscripciones, salario, arriendo. Finanzia los crea solos.
                </span>
              </div>
            </div>
            <span className="text-text-tertiary text-sm">→</span>
          </Link>

          <Link
            href="/ajustes/alertas"
            className="border-border-default bg-surface hover:bg-surface-hover/60 flex items-center justify-between gap-4 rounded-[12px] border p-5 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Bell
                strokeWidth={1.5}
                className={`mt-0.5 size-4 ${unreadAlerts > 0 ? 'text-text' : 'text-text-tertiary'}`}
              />
              <div className="flex flex-col gap-1">
                <span className="text-text text-sm font-semibold">Alertas</span>
                <span className="text-text-secondary text-[13px]">
                  {unreadAlerts === 0
                    ? 'Bandeja al día.'
                    : `${unreadAlerts} ${unreadAlerts === 1 ? 'alerta sin leer' : 'alertas sin leer'}.`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {unreadAlerts > 0 && (
                <span
                  aria-hidden
                  className="bg-accent-ai size-1.5 rounded-full"
                  style={{ background: 'var(--accent-ai)' }}
                />
              )}
              <span className="text-text-tertiary text-sm">→</span>
            </div>
          </Link>
        </div>
      </section>
    </div>
  )
}

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-5 py-4">
      <span className="text-text-secondary text-sm">{label}</span>
      <span
        className={`text-text text-sm${mono ? ' tabular' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
