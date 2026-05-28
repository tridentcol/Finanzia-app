import type { Metadata } from 'next'
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
    <div className="flex flex-col gap-8 max-w-lg">
      <div>
        <h1 className="text-xl font-semibold text-text">Perfil financiero</h1>
        <p className="text-sm text-text-secondary mt-1">
          Tu divisa base y método de ahorro.
        </p>
      </div>

      <PerfilFinancieroClient
        baseCurrency={(profile?.baseCurrency ?? 'COP') as 'COP' | 'USD' | 'EUR' | 'MXN'}
        locale={(profile?.locale ?? 'es-CO') as 'es-CO' | 'es-ES' | 'en-US' | 'es-MX'}
        activePlan={activePlan ?? null}
        isOnboarded={!!profile?.onboardedAt}
      />
    </div>
  )
}
