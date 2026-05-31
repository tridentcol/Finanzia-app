import 'server-only'
import { embed, tool } from 'ai'
import { z } from 'zod'
import { sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { getOpenAI, EMBEDDING_MODEL } from '@/lib/ai/openai'
import { toPgvectorLiteral } from '@/lib/ai/embed-transaction'
import type { CopilotContext } from '../context'

/**
 * Búsqueda SEMÁNTICA (RAG) sobre el historial: embebe la consulta y trae los
 * movimientos más parecidos por significado (kNN sobre `transactions.embedding`
 * con pgvector cosine). Complementa a `searchTransactions`, que es ILIKE (texto
 * literal). Los embeddings 1536d ya se generan al crear/importar.
 */
export function semanticSearchTransactionsTool(ctx: CopilotContext) {
  return tool({
    description:
      'Búsqueda SEMÁNTICA de transacciones por significado, no por texto exacto. Usala cuando el usuario describe un concepto o categoría difusa ("gastos de ocio", "cosas para la casa", "salidas con amigos") y la búsqueda literal no alcanza. Devuelve los movimientos más parecidos por embedding, con un score de similitud.',
    inputSchema: z.object({
      query: z
        .string()
        .min(2)
        .max(120)
        .describe('Descripción en lenguaje natural de lo que se busca.'),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    execute: async (input) => {
      const provider = await getOpenAI({ userId: ctx.userId, scope: 'embed' })
      if (!provider) {
        return { available: false, reason: 'embeddings_no_configurados', count: 0, transactions: [] }
      }

      let embedding: number[]
      try {
        const res = await embed({
          model: provider.textEmbedding(EMBEDDING_MODEL),
          value: input.query,
        })
        embedding = res.embedding
      } catch (err) {
        console.error('[copilot] semantic-search embed falló:', err)
        return { available: false, reason: 'embed_error', count: 0, transactions: [] }
      }

      const literal = toPgvectorLiteral(embedding)
      const limit = input.limit ?? 12
      const rows = await db.execute<{
        date: string
        description: string
        merchant: string | null
        kind: string
        amount_original: string
        currency: string
        amount_base: string
        account_name: string | null
        category_name: string | null
        similarity: number | string
      }>(sql`
        SELECT t.date, t.description, t.merchant, t.kind,
               t.amount_original, t.currency, t.amount_base,
               a.name AS account_name, c.name AS category_name,
               (1 - (t.embedding <=> ${literal}::vector)) AS similarity
        FROM transactions t
        LEFT JOIN accounts a ON a.id = t.account_id
        LEFT JOIN categories c ON c.id = t.category_id
        WHERE t.user_id = ${ctx.userId}
          AND t.deleted_at IS NULL
          AND t.embedding IS NOT NULL
        ORDER BY t.embedding <=> ${literal}::vector
        LIMIT ${limit}
      `)

      return {
        baseCurrency: ctx.baseCurrency,
        count: rows.length,
        transactions: rows.map((r) => ({
          date: r.date,
          description: r.description,
          merchant: r.merchant,
          kind: r.kind,
          amount: r.amount_original,
          currency: r.currency,
          amountBase: r.amount_base,
          account: r.account_name,
          category: r.category_name,
          similarity: Number(Number(r.similarity).toFixed(3)),
        })),
      }
    },
  })
}
