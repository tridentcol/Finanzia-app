import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import {
  AVAILABLE_SCOPES,
  DEFAULT_SCOPES,
  listUserIntegrations,
  type Provider,
} from '@/lib/integrations/store'
import { env } from '@/lib/env'
import { IntegrationCard } from '@/components/app/integration-card'

export const metadata: Metadata = {
  title: 'Integraciones',
}

const PROVIDERS: Array<{
  id: Provider
  name: string
  description: string
  signupUrl: string
}> = [
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description:
      'Modelo de lenguaje para el copiloto y para recomendaciones en /insights. Requiere una key sk-ant- desde console.anthropic.com.',
    signupUrl: 'https://console.anthropic.com/settings/keys',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    description:
      'Usado para embeddings (text-embedding-3-small, 1536 dim) que alimentan la auto-categorización. Una key barata, ~$0.02 por 1M tokens.',
    signupUrl: 'https://platform.openai.com/api-keys',
  },
]

export default async function IntegracionesPage() {
  const user = await requireCurrentUser()
  const integrations = await listUserIntegrations(user.id)
  const byProvider = new Map(integrations.map((i) => [i.provider, i]))
  const operatorGateway = !!env.AI_GATEWAY_API_KEY
  const operatorAnthropic = !!env.ANTHROPIC_API_KEY
  const operatorOpenai = !!env.OPENAI_API_KEY

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex min-w-0 flex-col gap-2">
        <div className="flex items-center gap-2">
          <Link
            href="/ajustes"
            className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors"
          >
            Ajustes
          </Link>
          <span className="text-text-tertiary text-[13px]">/</span>
          <span className="text-text-secondary text-[13px]">Integraciones</span>
        </div>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Integraciones IA
        </h1>
        <p className="text-text-secondary editorial max-w-prose text-base italic">
          Conecta tus propias claves. Finanzia las cifra con Supabase Vault y
          las usa sólo desde el servidor — nunca viajan al navegador.
        </p>
      </header>

      {(operatorGateway || operatorAnthropic || operatorOpenai) && (
        <aside className="border-border-default bg-surface flex flex-col gap-1 rounded-[12px] border p-4">
          <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Operador
          </span>
          <p className="text-text-secondary text-sm">
            {operatorGateway && 'AI Gateway operativo · '}
            {operatorAnthropic && 'Anthropic fallback · '}
            {operatorOpenai && 'OpenAI fallback · '}
            Si no configuras tu key, Finanzia usa estas reservas.
          </p>
        </aside>
      )}

      <section className="flex flex-col gap-4">
        {PROVIDERS.map((p) => (
          <IntegrationCard
            key={p.id}
            provider={p.id}
            name={p.name}
            description={p.description}
            signupUrl={p.signupUrl}
            availableScopes={AVAILABLE_SCOPES[p.id]}
            defaultScopes={DEFAULT_SCOPES[p.id]}
            integration={byProvider.get(p.id) ?? null}
          />
        ))}
      </section>

      <section className="border-border-default flex flex-col gap-3 rounded-[12px] border p-5">
        <h2 className="text-text text-sm font-semibold">Modo sin claves</h2>
        <p className="text-text-secondary text-sm">
          Cuando no hay clave configurada (ni tuya ni del operador), Finanzia
          opera con su motor heurístico interno: categorización por reglas de
          merchant, insights deterministas, copiloto con respuestas pre-cocidas
          a las preguntas más comunes. Todo funciona sin LLM.
        </p>
      </section>
    </div>
  )
}
