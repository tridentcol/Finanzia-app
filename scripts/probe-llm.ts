/**
 * Probe del modelo LLM del copiloto.
 *
 * Dispara una generación mínima contra el modelo configurado y reporta si el id
 * existe para esta cuenta. Si el modelo de prueba (gpt-5.4-mini) no está
 * disponible, reintenta con el fallback (gpt-5-mini) y lo sugiere.
 *
 * NO importa src/lib/ai/* (llevan `import 'server-only'`, que lanza fuera del
 * runtime server) ni usa el alias `@/` (tsx no lo resuelve por defecto). Lee la
 * key directo de process.env — JAMÁS la imprime.
 *
 * Uso: pnpm tsx --env-file=.env.local scripts/probe-llm.ts
 */

import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'

const DEFAULT_MODEL = 'gpt-5.4-mini'
const FALLBACK_MODEL = 'gpt-5-mini'

const EFFORTS = ['minimal', 'low', 'medium', 'high'] as const
const VERBOSITIES = ['low', 'medium', 'high'] as const

type Effort = (typeof EFFORTS)[number]
type Verbosity = (typeof VERBOSITIES)[number]

const requestedModel = process.env.COPILOT_LLM_MODEL?.trim() || DEFAULT_MODEL
const reasoningEffort: Effort = (EFFORTS as readonly string[]).includes(
  (process.env.COPILOT_REASONING_EFFORT ?? '').trim().toLowerCase(),
)
  ? (process.env.COPILOT_REASONING_EFFORT!.trim().toLowerCase() as Effort)
  : 'medium'
const textVerbosity: Verbosity = (VERBOSITIES as readonly string[]).includes(
  (process.env.COPILOT_TEXT_VERBOSITY ?? '').trim().toLowerCase(),
)
  ? (process.env.COPILOT_TEXT_VERBOSITY!.trim().toLowerCase() as Verbosity)
  : 'low'

const gatewayKey = process.env.AI_GATEWAY_API_KEY
const openaiKey = process.env.OPENAI_API_KEY

if (!gatewayKey && !openaiKey) {
  console.error(
    'Falta OPENAI_API_KEY (o AI_GATEWAY_API_KEY) en el entorno.\n' +
      'Ponla en .env.local y corré: pnpm tsx --env-file=.env.local scripts/probe-llm.ts',
  )
  process.exit(1)
}

const provider = gatewayKey
  ? createOpenAI({
      apiKey: gatewayKey,
      baseURL: 'https://gateway.ai.vercel.com/v1/openai',
    })
  : createOpenAI({ apiKey: openaiKey! })

const source = gatewayKey ? 'AI_GATEWAY_API_KEY' : 'OPENAI_API_KEY'

async function tryModel(modelId: string): Promise<boolean> {
  const started = Date.now()
  try {
    const res = await generateText({
      model: provider(modelId),
      system:
        'Eres un probe de salud. Responde únicamente con la palabra: listo.',
      prompt: 'Confirma que estás operativo.',
      providerOptions: {
        openai: { reasoningEffort, textVerbosity, store: false },
      },
    })
    const ms = Date.now() - started
    const usage = res.usage
    console.log(`  OK  ${modelId}  (${ms} ms)`)
    console.log(`      respuesta: ${JSON.stringify(res.text.slice(0, 80))}`)
    if (usage) {
      console.log(
        `      tokens: in=${usage.inputTokens ?? '?'} out=${usage.outputTokens ?? '?'} total=${usage.totalTokens ?? '?'}`,
      )
    }
    return true
  } catch (err) {
    const ms = Date.now() - started
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`  FAIL ${modelId}  (${ms} ms)`)
    console.log(`      ${msg.split('\n')[0]}`)
    return false
  }
}

async function main() {
  console.log('Probe LLM del copiloto Finanzia')
  console.log(`  proveedor: openai (key: ${source})`)
  console.log(
    `  reasoningEffort=${reasoningEffort} textVerbosity=${textVerbosity} store=false`,
  )
  console.log(`  modelo solicitado: ${requestedModel}`)
  console.log('')

  const primaryOk = await tryModel(requestedModel)
  if (primaryOk) {
    console.log('')
    console.log(`Listo. Usá COPILOT_LLM_MODEL=${requestedModel} (o el default).`)
    process.exit(0)
  }

  if (requestedModel !== FALLBACK_MODEL) {
    console.log('')
    console.log(`Reintentando con el fallback: ${FALLBACK_MODEL}...`)
    const fallbackOk = await tryModel(FALLBACK_MODEL)
    if (fallbackOk) {
      console.log('')
      console.log(
        `El modelo solicitado no está disponible para esta cuenta.\n` +
          `Configurá COPILOT_LLM_MODEL=${FALLBACK_MODEL} en .env.local.`,
      )
      process.exit(0)
    }
  }

  console.log('')
  console.error(
    'Ningún modelo respondió. Revisá que la key sea válida y tenga acceso a la\n' +
      'familia gpt-5. (La key nunca se imprime; verificá en platform.openai.com).',
  )
  process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
