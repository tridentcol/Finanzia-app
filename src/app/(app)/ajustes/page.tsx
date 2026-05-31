import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { PerfilSection } from '@/components/app/settings/perfil-section'
import { CategoriasSection } from '@/components/app/settings/categorias-section'
import { IntegracionesBancariasSection } from '@/components/app/settings/integraciones-bancarias-section'
import { IntegracionesIASection } from '@/components/app/settings/integraciones-ia-section'
import { CategorizationQualitySection } from '@/components/app/settings/categorization-quality-section'
import { AlertasSection } from '@/components/app/settings/alertas-section'
import { AparienciaSection } from '@/components/app/settings/apariencia-section'
import { SesionSection } from '@/components/app/settings/sesion-section'
import { ResponsiveSettingsSection } from '@/components/app/settings/responsive-settings-section'

export const metadata: Metadata = {
  title: 'Ajustes',
}

type SearchParams = Promise<{ kind?: string }>

type Section = {
  id: string
  label: string
  description: string
}

const SECTIONS: Section[] = [
  { id: 'perfil', label: 'Perfil', description: 'Divisa, locale, plan de ahorro' },
  { id: 'categorias', label: 'Categorías', description: 'Sistema y tuyas' },
  {
    id: 'integraciones-bancarias',
    label: 'Integraciones bancarias',
    description: 'Reenvío de emails sin scraping',
  },
  {
    id: 'integraciones-ia',
    label: 'Integraciones IA',
    description: 'Tus claves Anthropic / OpenAI',
  },
  {
    id: 'calidad-ia',
    label: 'Calidad de IA',
    description: 'Qué tan bien categoriza',
  },
  { id: 'alertas', label: 'Alertas', description: 'Bandeja accionable' },
  { id: 'apariencia', label: 'Apariencia', description: 'Modo oscuro o claro' },
  { id: 'sesion', label: 'Sesión', description: 'Cuenta y datos básicos' },
]

export default async function AjustesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  const params = await searchParams
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary text-sm">Ajustes</p>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Tu cuenta y preferencias
        </h1>
      </header>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[200px_1fr] lg:gap-16">
        {/* Sidebar interno — sólo desktop. En mobile la navegación es la
            propia lista de acordeón. */}
        <aside aria-label="Secciones de ajustes" className="hidden lg:block">
          <nav className="sticky top-[calc(var(--topbar-total)+16px)] flex flex-col gap-1">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="text-text-secondary hover:bg-surface-hover/60 hover:text-text rounded-[6px] px-3 py-2 text-[13px] transition-colors"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Secciones — acordeón en mobile, panel siempre abierto en desktop */}
        <div className="flex min-w-0 flex-col gap-3 lg:gap-16">
          {SECTIONS.map((s) => (
            <ResponsiveSettingsSection
              key={s.id}
              id={s.id}
              label={s.label}
              description={s.description}
            >
              <SectionContent
                id={s.id}
                user={user}
                profile={profile ?? null}
                searchParams={params}
              />
            </ResponsiveSettingsSection>
          ))}

          {/* Cross-link a recurrentes */}
          <aside className="border-border-default/60 rounded-[8px] border border-dashed p-4 text-[12px]">
            <span className="text-text-secondary">
              Las reglas recurrentes (salario, suscripciones, arriendo) viven
              en{' '}
              <Link
                href="/mi-plan/recurrentes"
                className="text-text underline-offset-2 hover:underline"
              >
                Mi plan · Recurrentes
              </Link>
              .
            </span>
          </aside>
        </div>
      </div>
    </div>
  )
}

async function SectionContent({
  id,
  user,
  profile,
  searchParams,
}: {
  id: string
  user: Awaited<ReturnType<typeof requireCurrentUser>>
  profile: typeof profiles.$inferSelect | null
  searchParams: { kind?: string }
}) {
  switch (id) {
    case 'perfil':
      return <PerfilSection userId={user.id} />
    case 'categorias':
      return <CategoriasSection userId={user.id} searchParams={searchParams} />
    case 'integraciones-bancarias':
      return <IntegracionesBancariasSection userId={user.id} />
    case 'integraciones-ia':
      return <IntegracionesIASection userId={user.id} />
    case 'calidad-ia':
      return <CategorizationQualitySection userId={user.id} />
    case 'alertas':
      return <AlertasSection userId={user.id} />
    case 'apariencia':
      return <AparienciaSection />
    case 'sesion':
      return (
        <SesionSection
          user={user}
          baseCurrency={profile?.baseCurrency ?? null}
          locale={profile?.locale ?? null}
          timezone={profile?.timezone ?? null}
        />
      )
    default:
      return null
  }
}
