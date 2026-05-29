import { eq } from 'drizzle-orm'

import {
  AVAILABLE_SCOPES,
  DEFAULT_SCOPES,
  listUserIntegrations,
  type Provider,
} from '@/lib/integrations/store'
import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import {
  COPILOT_MODEL_OPTIONS,
  getCopilotLlmConfig,
  parseCopilotOverride,
} from '@/lib/ai/copilot/config'
import { IntegrationCard } from '@/components/app/integration-card'
import { CopilotModelSelector } from '@/components/app/settings/copilot-model-selector'

const PROVIDERS: Array<{
  id: Provider
  name: string
  description: string
  signupUrl: string
}> = [
  {
    id: 'openai',
    name: 'OpenAI',
    description:
      'Cerebro del copiloto por defecto (modelo gpt-5 mini) si activas el scope Generación / Chat, y embeddings (text-embedding-3-small) para la auto-categorización si activas Embeddings. Key sk- desde platform.openai.com.',
    signupUrl: 'https://platform.openai.com/api-keys',
  },
  {
    id: 'anthropic',
    name: 'Anthropic Claude',
    description:
      'Alternativa de chat para el copiloto y para las recomendaciones de /insights (se usa cuando seleccionas Anthropic como proveedor). Key sk-ant- desde console.anthropic.com.',
    signupUrl: 'https://console.anthropic.com/settings/keys',
  },
]

type Props = { userId: string }

export async function IntegracionesIASection({ userId }: Props) {
  const integrations = await listUserIntegrations(userId)
  const byProvider = new Map(integrations.map((i) => [i.provider, i]))
  const operatorGateway = !!env.AI_GATEWAY_API_KEY
  const operatorAnthropic = !!env.ANTHROPIC_API_KEY
  const operatorOpenai = !!env.OPENAI_API_KEY

  // Modelo del copiloto: default del operador (env) + override del usuario.
  const operatorConfig = getCopilotLlmConfig()
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, userId),
    columns: { aiProfile: true },
  })
  const copilotOverride = parseCopilotOverride(
    (profile?.aiProfile as { copilot?: unknown } | null)?.copilot,
  )

  return (
    <div className="flex flex-col gap-6">
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

      <div className="flex flex-col gap-4">
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
      </div>

      <CopilotModelSelector
        operatorProvider={operatorConfig.provider}
        operatorModel={operatorConfig.model}
        modelOptions={COPILOT_MODEL_OPTIONS}
        override={copilotOverride}
      />

      <div className="border-border-default flex flex-col gap-3 rounded-[12px] border p-5">
        <h3 className="text-text text-sm font-semibold">Modo sin claves</h3>
        <p className="text-text-secondary text-sm leading-relaxed">
          Cuando no hay clave configurada (ni tuya ni del operador), Finanzia
          opera con su motor heurístico interno: categorización por reglas de
          merchant, insights deterministas, copiloto con respuestas pre-cocidas
          a las preguntas más comunes. Todo funciona sin LLM.
        </p>
      </div>
    </div>
  )
}
