import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { getActiveSavingsPlan } from './actions'
import { PerfilFinancieroClient } from './perfil-financiero-client'

export const metadata: Metadata = {
  title: 'Perfil financiero',
}

export default async function PerfilFinancieroPage() {
  const user = await requireCurrentUser()

  const [profile, activePlan] = await Promise.all([
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
    getActiveSavingsPlan(user.id),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-10 max-w-2xl">
      <header className="flex min-w-0 flex-col gap-1.5">
        <Link
          href="/ajustes"
          className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
        >
          ← Ajustes
        </Link>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Perfil financiero
        </h1>
        <p className="text-text-secondary editorial text-base italic max-w-prose">
          Tu divisa base, región y el método con el que Finanzia mide tu ahorro.
        </p>
      </header>

      <PerfilFinancieroClient
        baseCurrency={(profile?.baseCurrency ?? 'COP') as 'COP' | 'USD' | 'EUR' | 'MXN'}
        locale={(profile?.locale ?? 'es-CO') as 'es-CO' | 'es-ES' | 'en-US' | 'es-MX'}
        activePlan={activePlan ?? null}
        isOnboarded={!!profile?.onboardedAt}
      />
    </div>
  )
}
