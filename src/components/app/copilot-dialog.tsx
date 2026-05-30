'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Dialog } from 'radix-ui'
import { toast } from 'sonner'

import { icons } from '@/lib/design/icons'
import { Button } from '@/components/ui/button'
import { llmMessageToAnswer } from '@/lib/copilot/adapters/llm-to-ast'
import { derivePhase, PHASE_THINKING } from '@/lib/copilot/render/copilot-phase'
import type { LoosePart } from '@/lib/copilot/parts'
import { useIsMobile } from '@/hooks/use-mobile'
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
import { useDialogStore } from './dialog-store'

/**
 * Copiloto Finanzia — Cmd+J → "Preguntar a Finanzia".
 *
 * Contenedor del chat. El stream (ChatStream) es compartido: el LLM produce
 * UIMessages que un adaptador convierte a AnswerPayload, y el heurístico
 * emite el AnswerPayload directo en un part `data-answer`. Ambos se ven igual.
 */
export function CopilotDialog() {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'copilot'
  const [vp, setVp] = useState<{ h: number; top: number } | null>(null)

  // VisualViewport: en mobile el diálogo es full-screen y `position: fixed` se
  // ancla al LAYOUT viewport (no al visual). Al abrir el teclado en iOS el
  // navegador desplaza la página (offsetTop > 0) y deja la altura completa, por
  // lo que sin compensar se pierde el header arriba. Atamos el diálogo al
  // recuadro visible real: top = vv.offsetTop, height = vv.height → header fijo,
  // input justo sobre el teclado, mensajes scrollean. Desktop usa sm:* y no toca
  // estas vars. (Chrome/Android ya lo cubre con interactiveWidget:resizes-content;
  // este JS es además el fallback para iOS, donde esa meta se ignora.)
  useEffect(() => {
    if (!open || typeof window === 'undefined') return
    const vv = window.visualViewport
    if (!vv) return
    const sync = () => setVp({ h: vv.height, top: vv.offsetTop })
    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
    }
  }, [open])

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          style={
            vp
              ? ({ ['--copilot-vh']: `${vp.h}px`, ['--copilot-top']: `${vp.top}px` } as React.CSSProperties)
              : undefined
          }
          className="border-border-default bg-surface fixed z-50 flex flex-col overflow-hidden border shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 inset-x-0 top-[var(--copilot-top,0px)] h-[var(--copilot-vh,100dvh)] rounded-none sm:inset-auto sm:top-[12vh] sm:left-1/2 sm:h-[640px] sm:max-h-[76dvh] sm:w-[680px] sm:max-w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:rounded-[16px] data-[state=closed]:sm:zoom-out-95 data-[state=open]:sm:zoom-in-95"
        >
          <Dialog.Title className="sr-only">Preguntar a Finanzia</Dialog.Title>
          {open && <CopilotChat onClose={close} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type LooseMsg = {
  id: string
  role: string
  parts?: LoosePart[]
}

function userText(m: LooseMsg): string {
  return (m.parts ?? [])
    .filter((p) => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text as string)
    .join('')
}

function CopilotChat({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const isMobile = useIsMobile()
  const [input, setInput] = useState('')
  // Contexto conversacional efímero: vive en el cliente y se reenvía cada turno
  // como `body.context` en sendMessage (se lee en el handler, no en render).
  const contextRef = useRef<ConversationContext>(EMPTY_CONTEXT)

  const { messages, sendMessage, status, error, stop, setMessages } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
  })

  const isStreaming = status === 'streaming' || status === 'submitted'

  // Captura el contexto actualizado que emite el server (part data-context).
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
        if (payload) {
          out.push({ id: m.id, role: 'assistant', payload })
        } else if (isStreaming && i === lastIdx) {
          // Generando en vivo: fase humana derivada del stream.
          out.push({ id: m.id, role: 'assistant', pending: true, phase: derivePhase(m.parts) })
        } else {
          // Terminó sin contenido renderable (Detener, error o límite de pasos):
          // estado terminal honesto, no seguimos animando "trabajando".
          out.push({ id: m.id, role: 'assistant', pending: true, idle: true })
        }
      }
    }
    const last = list[lastIdx]
    if (isStreaming && (!last || last.role === 'user')) {
      out.push({ id: 'pending', role: 'assistant', pending: true, phase: PHASE_THINKING })
    }
    return out
  }, [messages, isStreaming])

  // Motor del copiloto: Local (default) o un modelo de IA con key integrada.
  // Se carga al abrir y persiste por usuario; el badge del header lo refleja.
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
    setEngineValue(next) // optimista
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
    // El contexto se lee aquí (handler), no en render: reenvía el último estado.
    sendMessage({ text: t }, { body: { context: contextRef.current } })
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    submit(input)
  }

  const Spark = icons.sparkles
  const X = icons.x

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-default flex shrink-0 items-center justify-between gap-2 border-b px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <Spark strokeWidth={1.5} className="size-4 shrink-0" style={{ color: 'var(--accent-ai)' }} />
          <span className="text-text shrink-0 text-sm font-semibold">Finanzia</span>
          <CopilotEngineMenu options={engineOptions} value={engineValue} onSelect={selectEngine} />
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={() => {
                contextRef.current = EMPTY_CONTEXT
                setMessages([])
              }}
              className="text-text-tertiary hover:text-text rounded-[6px] px-2 py-1 text-[12px]"
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="text-text-tertiary hover:text-text -m-1 rounded-[6px] p-1"
          >
            <X strokeWidth={1.5} className="size-4" />
          </button>
        </div>
      </header>

      {/* min-h-0: imprescindible para que un flex-item con overflow scrollee en
          vez de crecer y empujar el input fuera. overscroll-contain evita que el
          scroll encadene al body (y que el VisualViewport salte en iOS). */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">
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
          className="text-text placeholder:text-text-tertiary min-h-[44px] flex-1 bg-transparent px-2 py-2 text-base outline-none sm:text-sm"
          // En mobile no autoenfocamos: abrir el copiloto no debe disparar el
          // teclado y tapar el estado vacío / las sugerencias. En desktop sí.
          autoFocus={!isMobile}
        />
        {isStreaming ? (
          <Button type="button" variant="outline" size="sm" onClick={() => stop()}>
            Detener
          </Button>
        ) : (
          <Button type="submit" size="sm" disabled={!input.trim()}>
            Enviar
          </Button>
        )}
      </form>
    </div>
  )
}
