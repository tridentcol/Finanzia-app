/**
 * Seed de ejemplos de intents para el NLU semántico del copiloto.
 *
 * Embebe cada frase del corpus (INTENT_CORPUS) con text-embedding-3-small y la
 * persiste en `intent_examples`. Refresco completo (borra e inserta) para que
 * la tabla siempre refleje el corpus actual.
 *
 * NO importa src/lib/ai/openai.ts ni embed-transaction.ts: ambos llevan
 * `import 'server-only'`, que lanza fuera del runtime server. Usa el SDK de
 * OpenAI directo con la key del entorno.
 *
 * Uso: pnpm tsx --env-file=.env.local scripts/seed-intent-examples.ts
 */

import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { createOpenAI } from '@ai-sdk/openai'
import { embedMany } from 'ai'
import { intentExamples, type NewIntentExample } from '../src/lib/db/schema'
import { INTENT_CORPUS } from '../src/lib/copilot/nlu/intent-corpus'

const EMBEDDING_MODEL = 'text-embedding-3-small'

const url = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!url) {
  console.error('Falta DIRECT_URL o DATABASE_URL en el entorno.')
  process.exit(1)
}

const apiKey = process.env.OPENAI_API_KEY
const gatewayKey = process.env.AI_GATEWAY_API_KEY
if (!apiKey && !gatewayKey) {
  console.error('Falta OPENAI_API_KEY (o AI_GATEWAY_API_KEY) para generar embeddings.')
  process.exit(1)
}

const sqlClient = postgres(url, { prepare: false, max: 1 })
const db = drizzle(sqlClient, { casing: 'snake_case' })

const provider = gatewayKey
  ? createOpenAI({ apiKey: gatewayKey, baseURL: 'https://gateway.ai.vercel.com/v1/openai' })
  : createOpenAI({ apiKey: apiKey! })

async function main() {
  // Aplana el corpus a (intent, text) y embebe en batch.
  const pairs: Array<{ intent: string; text: string }> = []
  for (const [intent, texts] of Object.entries(INTENT_CORPUS)) {
    for (const text of texts) pairs.push({ intent, text })
  }
  if (pairs.length === 0) {
    console.error('Corpus vacío.')
    process.exit(1)
  }

  console.log(`Embebiendo ${pairs.length} ejemplos con ${EMBEDDING_MODEL}...`)
  const { embeddings } = await embedMany({
    model: provider.textEmbedding(EMBEDDING_MODEL),
    values: pairs.map((p) => p.text),
  })

  const rows: NewIntentExample[] = pairs.map((p, i) => ({
    intent: p.intent,
    text: p.text,
    embedding: embeddings[i] as number[],
  }))

  // Refresco completo: la tabla refleja exactamente el corpus.
  await db.delete(intentExamples)
  // Inserta en lotes para no exceder límites de parámetros.
  const BATCH = 100
  for (let i = 0; i < rows.length; i += BATCH) {
    await db.insert(intentExamples).values(rows.slice(i, i + BATCH))
  }

  console.log(`Sembrados ${rows.length} ejemplos en intent_examples.`)
  console.log('Hecho.')
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await sqlClient.end()
  })
