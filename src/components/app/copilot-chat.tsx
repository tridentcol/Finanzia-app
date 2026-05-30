'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { toast } from 'sonner'

import { icons } from '@/lib/design/icons'
import { Button } from '@/components/ui/button'
import { llmMessageToAnswer } from '@/lib/copilot/adapters/llm-to-ast'
import { derivePhase, PHASE_THINKING } from '@/lib/copilot/render/copilot-phase'
import type { LoosePart } from '@/lib/copilot/parts'
import { useIsMobile } from '@/hooks/use-mobile'
import { useChatViewport } from '@/hooks/use-chat-viewport'
import { KeyboardDebug } from '@/components/copilot/keyboard-debug'
import { ChatStream } from '@/components/copilot/chat-stream'
import { CopilotEmptyState } from '@/components/copilot/empty-state'
import { CopilotEngineMenu } from '@/components/copilot/engine-menu'
import type { Turn } from '@/components/copilot/turn'
import { EMPTY_CONTEXT, type ConversationContext } from '@/lib/copilot/conversation/reducer'
import {
  getCopilotChoices,
  setCopilotEngine,
  type CopilotChoice,
} from '@/app/(app)/copilot/actions'

/**
 * Copiloto Finanzia como PÁGINA (ruta /copilot), no como ventana flotante. Es un
 * chat normal: header arriba, mensajes scrolleables, input abajo. Se navega libre
 * (botón atrás / historial); sin modal radix → sin focus-trap ni "tocar fuera".
 *
 * Teclado en mobile: el contenedor es `fixed` y se ancla al viewport VISIBLE vía
 * `useChatViewport` (altura + compensación del paneo de iOS con translateY). El
 * layout no se mueve: el header queda fijo, el input se posa sobre el teclado y
 * los últimos mensajes suben dentro del scroll interno. En desktop (≥sm) vuelve a
 * flujo normal, centrado, y el hook se desactiva.
 */
type LooseMsg = { id: string; role: string; parts?: LoosePart[] }

function userText(m: LooseMsg): string {
  return (m.parts ?? [])
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
}

export function CopilotChat() {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [input, setInput] = useState('')
  const contextRef = useRef<ConversationContext>(EMPTY_CONTEXT)
  const containerRef = useRef<HTMLDivElement>(null)
  const scrollerRef = useRef<HTMLDivElement>(null)

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
  })
  const isStreaming = status === 'streaming' || status === 'submitted'

  // Teclado mobile sin saltos de layout: ancla el contenedor `fixed` al viewport
  // visible (altura + paneo de iOS). Ver el hook para el detalle por plataforma.
  useChatViewport({ containerRef, scrollerRef })

  // Captura el contexto conversacional que emite el server (part data-context).
  useEffect(() => {
    const list = messages as unknown as LooseMsg[]
    for (let i = list.length - 1; i >= 0; i--) {
      const m = list[i]
      if (m?.role !== 'assistant') continue
      const ctxPart = (m.parts ?? []).find((p) => p.type === 'data-context')
      if (ctxPart?.data) contextRef.current = ctxPart.data as ConversationContext
      break
    }
  }, [messages])

  const turns: Turn[] = useMemo(() => {
    const list = messages as unknown as LooseMsg[]
    const out: Turn[] = []
    const lastIdx = list.length - 1
    for (let i = 0; i < list.length; i++) {
      const m = list[i]
      if (!m) continue
      if (m.role === 'user') {
        out.push({ id: m.id, role: 'user', text: userText(m) })
      } else if (m.role === 'assistant') {
        const payload = llmMessageToAnswer(m)
        if (payload) out.push({ id: m.id, role: 'assistant', payload })
        else if (isStreaming && i === lastIdx)
          out.push({ id: m.id, role: 'assistant', pending: true, phase: derivePhase(m.parts) })
        else out.push({ id: m.id, role: 'assistant', pending: true, idle: true })
      }
    }
    const last = list[lastIdx]
    if (isStreaming && (!last || last.role === 'user')) {
      out.push({ id: 'pending', role: 'assistant', pending: true, phase: PHASE_THINKING })
    }
    return out
  }, [messages, isStreaming])

  const [engineOptions, setEngineOptions] = useState<CopilotChoice[]>([])
  const [engineValue, setEngineValue] = useState<string>('local')
  useEffect(() => {
    let active = true
    getCopilotChoices()
      .then((r) => {
        if (!active) return
        setEngineOptions(r.options)
        setEngineValue(r.current)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  function selectEngine(next: string) {
    if (next === engineValue) return
    const prev = engineValue
    setEngineValue(next)
    setCopilotEngine(next)
      .then((res) => {
        if (!res.ok) {
          setEngineValue(prev)
          toast.error(res.error.message)
        }
      })
      .catch(() => {
        setEngineValue(prev)
        toast.error('No se pudo cambiar el motor.')
      })
  }

  function submit(text: string) {
    const t = text.trim()
    if (!t || isStreaming) return
    setInput('')
    sendMessage({ text: t }, { body: { context: contextRef.current } })
  }
  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit(input)
  }

  function goBack() {
    if (window.history.length > 1) router.back()
    else router.push('/dashboard')
  }

  const Spark = icons.sparkles
  const Back = icons['arrow-left']

  return (
    <div
      ref={containerRef}
      className="bg-surface fixed inset-x-0 top-0 flex h-[100dvh] flex-col overflow-hidden sm:static sm:mx-auto sm:h-dvh sm:max-w-3xl"
    >
      {/* TEMPORAL: diagnóstico del teclado. BORRAR tras capturar datos. */}
      <KeyboardDebug targetRef={containerRef} />
      <header
        className="border-border-default flex shrink-0 items-center justify-between gap-2 border-b px-3 py-3"
        style={{ paddingTop: 'max(0.75rem, env(safe-area-inset-top, 0px))' }}
      >
        <div className="flex min-w-0 items-center gap-1.5">
          <button
            type="button"
            onClick={goBack}
            aria-label="Volver"
            className="text-text-tertiary hover:text-text -ml-1 flex size-11 shrink-0 items-center justify-center rounded-[8px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40"
          >
            <Back strokeWidth={1.5} className="size-5" />
          </button>
          <Spark
            strokeWidth={1.5}
            aria-hidden
            className="size-4 shrink-0"
            style={{ color: 'var(--accent-ai)' }}
          />
          <span className="text-text shrink-0 text-sm font-semibold">Finanzia</span>
          <CopilotEngineMenu options={engineOptions} value={engineValue} onSelect={selectEngine} />
        </div>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={() => {
              contextRef.current = EMPTY_CONTEXT
              setMessages([])
            }}
            className="text-text-tertiary hover:text-text inline-flex min-h-11 shrink-0 items-center rounded-[6px] px-2.5 text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40"
          >
            Limpiar
          </button>
        )}
      </header>

      {/* min-h-0 + overscroll-contain: scroll real del flex-item, sin encadenar al body. */}
      <div
        ref={scrollerRef}
        role="log"
        aria-label="Conversación con el copiloto"
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4"
      >
        {messages.length === 0 ? (
          <CopilotEmptyState onPick={submit} />
        ) : (
          <ChatStream turns={turns} onFollowUp={submit} onConfirm={() => router.refresh()} />
        )}
      </div>

      {error && (
        <div className="border-border-default shrink-0 border-t px-5 py-2">
          <p className="text-negative text-xs">{error.message}</p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="border-border-default flex shrink-0 items-center gap-2 border-t px-3 py-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta cualquier cosa sobre tus finanzas"
          aria-label="Mensaje para el copiloto"
          enterKeyHint="send"
          autoComplete="off"
          className="text-text placeholder:text-text-tertiary min-h-[44px] flex-1 rounded-[8px] bg-transparent px-2 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[color:var(--accent-ai)]/40 sm:text-sm"
          autoFocus={!isMobile}
        />
        {isStreaming ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-11"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => stop()}
          >
            Detener
          </Button>
        ) : (
          <Button
            type="submit"
            size="sm"
            className="h-11"
            onMouseDown={(e) => e.preventDefault()}
            disabled={!input.trim()}
          >
            Enviar
          </Button>
        )}
      </form>
    </div>
  )
}
