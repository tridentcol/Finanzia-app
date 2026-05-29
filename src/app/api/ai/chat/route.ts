import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { conversations, messages, profiles } from '@/lib/db/schema'
import { resolveCopilotProvider, runCopilotChat } from '@/lib/ai/copilot'
import { routeLocal } from '@/lib/copilot/orchestrator'
import { retrievalFallback } from '@/lib/copilot/fallback/retrieval'
import type { ConversationContext } from '@/lib/copilot/conversation/reducer'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
// 60s tope — incluye múltiples tool calls + texto final.
export const maxDuration = 60

// useChat de @ai-sdk/react v6 manda `id` como nanoid (no uuid) y puede
// añadir campos extra como `trigger`, `messageId`. Usamos `passthrough` y
// no validamos tipos estrictos del `id` para no romper.
const bodySchema = z
  .object({
    id: z.string().min(1).optional(),
    messages: z.array(z.unknown()).min(1, 'Necesito al menos un mensaje.'),
    // Contexto conversacional efímero que el cliente reenvía cada turno.
    context: z.unknown().optional(),
  })
  .passthrough()

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

type IncomingMessage = {
  role?: string
  parts?: Array<{ type?: string; text?: string }>
}

function textOf(message: IncomingMessage | undefined): string {
  if (!message?.parts) return ''
  return message.parts
    .filter((p) => p?.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
    .trim()
}

/**
 * Endpoint del copiloto. Recibe `{ id?, messages, ... }` desde `useChat` y
 * devuelve un `UIMessageStream`.
 *
 * - Con LLM disponible: stream del modelo + persistencia del turno en
 *   `conversations`/`messages`.
 * - Sin LLM: motor heurístico interno, que emite un único part `data-answer`
 *   con el AnswerPayload estructurado. Conversación EFÍMERA — no toca la tabla
 *   `messages`; el contexto multi-turno se reconstruye del historial recibido.
 */
export async function POST(req: Request) {
  let user
  try {
    user = await requireCurrentUser()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'No autenticado.' } },
      { status: 401 },
    )
  }

  let parsedBody: z.infer<typeof bodySchema>
  try {
    const raw = await req.json()
    const parsed = bodySchema.safeParse(raw)
    if (!parsed.success) {
      const detail =
        parsed.error.issues[0]?.message ?? 'Estructura del body inesperada.'
      return NextResponse.json(
        { ok: false, error: { code: 'validation', message: detail } },
        { status: 400 },
      )
    }
    parsedBody = parsed.data
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'validation', message: 'JSON inválido.' } },
      { status: 400 },
    )
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })
  const baseCurrency = profile?.baseCurrency ?? 'COP'

  const incoming = parsedBody.messages as IncomingMessage[]
  const todayIso = new Date().toISOString().slice(0, 10)

  // ---- Ruteo local-first. ----
  // Por default intentamos el motor local primero: si es confiado responde
  // local (gratis, aunque haya LLM key). Si difiere, va al LLM (si hay provider)
  // o al fallback de recuperación. Con COPILOT_FORCE_LLM=1 se salta el
  // local-first y todo va al LLM mientras se evalúa el modelo.
  // Config efectiva (env del operador + override del usuario) viene resuelta
  // dentro de `resolved.config`. forceLLM es del operador (env), preservado ahí.
  const resolved = await resolveCopilotProvider(user.id)
  const forceLLM = resolved?.config.forceLLM ?? false
  const utterances = incoming
    .filter((m) => m?.role === 'user')
    .map((m) => textOf(m))
    .filter((t) => t.length > 0)

  // El cliente lleva el contexto conversacional y lo reenvía; lo usamos para
  // continuidad real (referencias, slots heredados) en vez de reconstruir.
  const clientContext = parsedBody.context as ConversationContext | undefined
  const routed = await routeLocal(
    utterances,
    { userId: user.id, baseCurrency, todayIso },
    clientContext,
  )

  // Al LLM si hay provider y (forzamos o el motor local difirió).
  const goLLM = Boolean(resolved) && (forceLLM || routed.mode === 'defer')

  if (process.env.FINANZIA_COPILOT_DEBUG === '1') {
    console.log('[copilot:route]', {
      last: utterances[utterances.length - 1],
      mode: goLLM ? 'llm' : routed.mode === 'local' ? 'local' : 'fallback',
      intent: routed.result.resolvedIntent,
      confidence: Number(routed.result.classification.confidence.toFixed(2)),
      hasLLM: Boolean(resolved),
      forceLLM,
      provider: resolved?.kind ?? null,
      model: resolved?.config.model ?? null,
    })
  }

  // Responde local cuando es confiado y no forzamos LLM, o cuando no hay
  // provider (defer/forzado sin destino → fallback de recuperación).
  if (!goLLM) {
    // Confiado → respuesta del motor. Defer sin LLM → fallback de recuperación.
    const payload =
      routed.mode === 'local'
        ? routed.result.payload
        : await retrievalFallback(utterances[utterances.length - 1] ?? '', {
            userId: user.id,
            baseCurrency,
            todayIso,
          })
    const nextContext = routed.result.nextContext
    const stream = createUIMessageStream({
      execute({ writer }) {
        const id = `local-${todayIso}-${utterances.length}`
        writer.write({ type: 'data-answer', id, data: payload })
        // Contexto actualizado para que el cliente lo reenvíe en el próximo turno.
        writer.write({ type: 'data-context', id: `${id}-ctx`, data: nextContext })
      },
    })
    const response = createUIMessageStreamResponse({ stream })
    response.headers.set('x-copilot-mode', routed.mode === 'local' ? 'local' : 'fallback')
    return response
  }

  // ---- Camino LLM: persiste el turno. ----
  let conversationId: string | undefined
  if (parsedBody.id && UUID_RE.test(parsedBody.id)) {
    const existing = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(
        and(eq(conversations.id, parsedBody.id), eq(conversations.userId, user.id)),
      )
      .limit(1)
    if (existing[0]) conversationId = existing[0].id
  }
  if (!conversationId) {
    const [row] = await db
      .insert(conversations)
      .values({ userId: user.id, title: null })
      .returning({ id: conversations.id })
    conversationId = row?.id
  }
  if (!conversationId) {
    return NextResponse.json(
      { ok: false, error: { code: 'persist_failed', message: 'No se pudo crear la conversación.' } },
      { status: 500 },
    )
  }

  const lastUserMessage = [...incoming].reverse().find((m) => m?.role === 'user')
  if (lastUserMessage) {
    await db.insert(messages).values({
      conversationId,
      role: 'user',
      content: lastUserMessage as Record<string, unknown>,
    })
  }

  const result = await runCopilotChat({
    ctx: { userId: user.id, baseCurrency },
    messages: incoming as Parameters<typeof runCopilotChat>[0]['messages'],
    resolved: resolved ?? undefined,
    onFinish: async (event) => {
      if (process.env.FINANZIA_COPILOT_DEBUG === '1') {
        const toolCalls = Array.isArray(event.toolCalls) ? event.toolCalls.length : 0
        console.log('[copilot:llm]', {
          provider: resolved?.kind ?? null,
          model: resolved?.config.model ?? null,
          reasoningEffort: resolved?.config.reasoningEffort ?? null,
          finishReason: event.finishReason ?? null,
          toolCalls,
          usage: event.usage ?? null,
        })
      }
      try {
        await db.insert(messages).values({
          conversationId: conversationId!,
          role: 'assistant',
          content: {
            text: event.text ?? null,
            finishReason: event.finishReason ?? null,
            toolCalls: event.toolCalls ?? null,
            toolResults: event.toolResults ?? null,
          } as Record<string, unknown>,
        })
        await db
          .update(conversations)
          .set({ updatedAt: new Date() })
          .where(eq(conversations.id, conversationId!))
      } catch (err) {
        console.error('[copilot] persist falló:', err)
      }
    },
  })

  if (!result) {
    return NextResponse.json(
      { ok: false, error: { code: 'llm_unavailable', message: 'El modelo no está disponible.' } },
      { status: 503 },
    )
  }

  const response = result.toUIMessageStreamResponse()
  response.headers.set('x-conversation-id', conversationId)
  response.headers.set('x-copilot-mode', 'llm')
  response.headers.set('x-copilot-provider', resolved?.kind ?? 'unknown')
  response.headers.set('x-copilot-model', resolved?.config.model ?? 'unknown')
  return response
}
