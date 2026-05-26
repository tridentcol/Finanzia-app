import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const metadata: Metadata = {
  title: 'Ajustes',
}

export default async function AjustesPage() {
  const user = await requireCurrentUser()
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })

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
