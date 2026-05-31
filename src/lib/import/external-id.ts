import 'server-only'
import { createHash } from 'node:crypto'

/**
 * Huella estable de un registro de ingesta (CSV/email) para idempotencia.
 *
 * Determinística sobre el contenido del origen: reimportar el mismo archivo o
 * reprocesar el mismo email produce el mismo `externalId`, y el índice único
 * parcial `(user_id, external_id)` evita duplicar la fila.
 *
 * `occurrence` desambigua filas legítimamente idénticas dentro de un mismo
 * origen (p. ej. dos cafés iguales el mismo día en un CSV): cada una recibe un
 * índice distinto, así ambas sobreviven y la reimportación sigue deduplicando.
 */
export function transactionExternalId(parts: {
  /** Origen estable, p. ej. 'csv' o 'email:bancolombia'. */
  source: string
  accountId: string
  date: string
  amount: string
  currency: string
  description: string
  occurrence?: number
}): string {
  const key = [
    parts.source,
    parts.accountId,
    parts.date,
    parts.amount,
    parts.currency,
    parts.description.trim().toLowerCase(),
    parts.occurrence ?? 0,
  ].join('|')
  return createHash('sha256').update(key).digest('hex')
}
