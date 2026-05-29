import 'server-only'

import { db } from '@/lib/db/client'
import { intentExamples } from '@/lib/db/schema'

/**
 * Lista todos los ejemplos de intent (catálogo global). El match en runtime se
 * hace por kNN en SQL (ver semantic-classifier); esta query es utilitaria.
 */
export async function listIntentExamples() {
  return db
    .select({ id: intentExamples.id, intent: intentExamples.intent, text: intentExamples.text })
    .from(intentExamples)
}
