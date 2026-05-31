import { NextResponse } from 'next/server'
import { generateText, stepCountIs } from 'ai'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { resolveCopilotProvider } from '@/lib/ai/copilot'
import { buildCopilotTools } from '@/lib/ai/copilot/tools'
import { buildSystemPrompt } from '@/lib/ai/copilot/system-prompt'
import { buildProfileSnapshot } from '@/lib/ai/copilot/profile-snapshot'
import { COPILOT_GOLDEN } from '@/lib/ai/evals/copilot-golden'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Runner del golden set de tool-calls del copiloto — mide si el LLM elige la
 * herramienta correcta por pregunta. Reusa el MISMO setup que `runCopilotChat`
 * (mismo modelo, system prompt con snapshot, tools) pero con `generateText` y
 * `stopWhen: stepCountIs(1)`: deja que el modelo elija la tool del primer paso
 * y la inspecciona, sin sintetizar la respuesta. Las tools propose-* no mutan
 * (regla 6), así que ejecutarlas en el eval es seguro.
 *
 * SOLO dev/preview (404 en prod). Uso: con sesión iniciada y key del copiloto
 * configurada, abrir `/api/dev/eval-copilot`.
 */
export async function GET() {
  if (env.NODE_ENV === 'production') {
    return NextResponse.json(
      { ok: false, error: { code: 'disabled', message: 'Eval no disponible en producción.' } },
      { status: 404 },
    )
  }

  let user
  try {
    user = await requireCurrentUser()
  } catch {
    return NextResponse.json(
      { ok: false, error: { code: 'unauthorized', message: 'No autenticado.' } },
      { status: 401 },
    )
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
    columns: { baseCurrency: true },
  })
  const baseCurrency = profile?.baseCurrency ?? 'COP'

  const resolved = await resolveCopilotProvider(user.id)
  if (!resolved) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: 'no_llm', message: 'No hay proveedor LLM configurado para el copiloto.' },
      },
      { status: 400 },
    )
  }

  const ctx = { userId: user.id, baseCurrency }
  const tools = buildCopilotTools(ctx)
  const todayIso = new Date().toISOString().slice(0, 10)

  let profileSnapshot: string | undefined
  let toneHints
  try {
    const snap = await buildProfileSnapshot({ userId: user.id, baseCurrency, todayIso })
    profileSnapshot = snap.text
    toneHints = snap.toneHints
  } catch (err) {
    console.error('[eval-copilot] snapshot falló:', err)
  }

  const system = buildSystemPrompt({ baseCurrency, todayIso, profileSnapshot, toneHints })
  const providerOptions =
    resolved.kind === 'openai'
      ? {
          openai: {
            reasoningEffort: resolved.config.reasoningEffort,
            textVerbosity: resolved.config.textVerbosity,
            store: resolved.config.store,
          },
        }
      : undefined

  const startedAt = Date.now()
  const results: Array<{
    question: string
    expected: string
    called: string | null
    ok: boolean
  }> = []
  let correct = 0

  for (const c of COPILOT_GOLDEN) {
    let called: string | null = null
    try {
      const r = await generateText({
        model: resolved.model,
        system,
        messages: [{ role: 'user', content: c.question }],
        tools,
        stopWhen: stepCountIs(1),
        ...(providerOptions ? { providerOptions } : {}),
      })
      called = r.toolCalls[0]?.toolName ?? null
    } catch (err) {
      console.error('[eval-copilot] generateText falló:', err)
    }
    const ok = called === c.expectedTool
    if (ok) correct++
    results.push({ question: c.question, expected: c.expectedTool, called, ok })
  }

  const total = COPILOT_GOLDEN.length
  return NextResponse.json({
    ok: true,
    data: {
      total,
      correct,
      accuracy: total > 0 ? Number((correct / total).toFixed(3)) : 0,
      misses: results.filter((r) => !r.ok),
      durationMs: Date.now() - startedAt,
    },
  })
}
