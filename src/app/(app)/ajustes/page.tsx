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

  const settings: Array<{
    href: string
    label: string
    description: string
    icon: keyof typeof icons
    accent?: boolean
    badge?: number
  }> = [
    {
      href: '/ajustes/perfil-financiero',
      label: 'Perfil financiero',
      description: profile?.onboardedAt
        ? `Moneda ${profile.baseCurrency} · Plan de ahorro configurado.`
        : 'Completa tu perfil para activar recomendaciones personalizadas.',
      icon: 'user',
      accent: !profile?.onboardedAt,
    },
    {
      href: '/ajustes/integraciones',
      label: 'Integraciones IA',
      description:
        integrations.length === 0
          ? 'Sin claves configuradas — operando en modo heurístico.'
          : `${integrations.length} ${
              integrations.length === 1
                ? 'integración activa'
                : 'integraciones activas'
            }.`,
      icon: 'sparkles',
      accent: true,
    },
    {
      href: '/ajustes/recurring',
      label: 'Reglas recurrentes',
      description: 'Suscripciones, salario, arriendo. Finanzia las crea solas.',
      icon: 'repeat',
    },
    {
      href: '/ajustes/alertas',
      label: 'Alertas',
      description:
        unreadAlerts === 0
          ? 'Bandeja al día.'
          : `${unreadAlerts} ${unreadAlerts === 1 ? 'alerta sin leer' : 'alertas sin leer'}.`,
      icon: 'bell',
      badge: unreadAlerts,
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="text-text-secondary text-sm">Ajustes</p>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
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
          {settings.map((s) => {
            const Icon = icons[s.icon]
            return (
              <Link
                key={s.href}
                href={s.href}
                aria-label={`${s.label} — ${s.description}`}
                className="border-border-default bg-surface hover:bg-surface-hover/60 flex min-h-[64px] min-w-0 items-center justify-between gap-4 rounded-[12px] border p-5 transition-colors"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <Icon
                    strokeWidth={1.5}
                    className={`size-4 shrink-0 ${
                      s.badge && s.badge > 0
                        ? 'text-text'
                        : s.accent
                          ? ''
                          : 'text-text-tertiary'
                    }`}
                    style={s.accent ? { color: 'var(--accent-ai)' } : undefined}
                  />
                  <div className="flex min-w-0 flex-col gap-1">
                    <span className="text-text text-sm font-semibold">{s.label}</span>
                    <span className="text-text-secondary truncate text-[13px]">
                      {s.description}
                    </span>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {s.badge && s.badge > 0 ? (
                    <span
                      aria-live="polite"
                      aria-label={`${s.badge} sin leer`}
                      className="text-text-tertiary tabular text-[11px]"
                    >
                      <span
                        aria-hidden
                        className="mr-1.5 inline-block size-1.5 rounded-full align-middle"
                        style={{ background: 'var(--accent-ai)' }}
                      />
                      {s.badge}
                    </span>
                  ) : null}
                  <span className="text-text-tertiary text-sm" aria-hidden>→</span>
                </div>
              </Link>
            )
          })}
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
    <div className="flex items-center justify-between gap-4 px-5 py-4">
      <span className="text-text-secondary text-sm">{label}</span>
      <span
        className={`text-text truncate text-right text-sm${mono ? ' tabular' : ''}`}
      >
        {value}
      </span>
    </div>
  )
}
