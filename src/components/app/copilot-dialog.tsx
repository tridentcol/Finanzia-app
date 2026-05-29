'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { Dialog } from 'radix-ui'
import { toast } from 'sonner'

import { icons } from '@/lib/design/icons'
import { Button } from '@/components/ui/button'
import {
  confirmProposedBudget,
  confirmProposedTransaction,
} from '@/app/(app)/copilot/actions'
import { cn } from '@/lib/utils'
import { useDialogStore } from './dialog-store'

/**
 * Copiloto Finanzia — Cmd+K → "Preguntar a Finanzia".
 *
 * UI streaming con `useChat` v6. Cada mensaje se compone de parts (text,
 * tool calls, tool results). Para tools propose-*, renderizamos una tarjeta
 * de confirmación con botones Confirmar / Descartar — la mutación REAL pasa
 * por la server action correspondiente (regla 6 del mandato).
 */
export function CopilotDialog() {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'copilot'

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && close()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="border-border-default bg-surface fixed z-50 flex flex-col overflow-hidden border shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 inset-0 h-svh w-screen rounded-none sm:inset-auto sm:top-[12vh] sm:left-1/2 sm:h-[640px] sm:max-h-[76vh] sm:w-[680px] sm:max-w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:rounded-[16px] data-[state=closed]:sm:zoom-out-95 data-[state=open]:sm:zoom-in-95"
        >
          <Dialog.Title className="sr-only">Preguntar a Finanzia</Dialog.Title>
          {open && <CopilotChat onClose={close} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function CopilotChat({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const { messages, sendMessage, status, error, stop } = useChat({
    transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || status === 'streaming' || status === 'submitted') return
    setInput('')
    sendMessage({ text })
  }

  const isStreaming = status === 'streaming' || status === 'submitted'
  const Spark = icons.sparkles
  const X = icons.x

  return (
    <div className="flex h-full flex-col">
      <header className="border-border-default flex items-center justify-between gap-3 border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Spark
            strokeWidth={1.5}
            className="size-4"
            style={{ color: 'var(--accent-ai)' }}
          />
          <span className="text-text text-sm font-semibold">Finanzia</span>
          <span className="text-text-tertiary text-[11px]">copiloto</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="text-text-tertiary hover:text-text -m-1 rounded-[6px] p-1"
        >
          <X strokeWidth={1.5} className="size-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <EmptyHints
            onPick={(q) => {
              setInput('')
              sendMessage({ text: q })
            }}
          />
        )}
        <ul className="flex flex-col gap-4">
          {messages.map((m) => (
            <li key={m.id}>
              <MessageBubble
                message={m}
                onConfirm={() => router.refresh()}
              />
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <div className="border-border-default border-t px-5 py-2">
          <p className="text-negative text-xs">{error.message}</p>
        </div>
      )}

      <form
        onSubmit={onSubmit}
        className="border-border-default flex items-center gap-2 border-t px-3 py-2"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta cualquier cosa sobre tus finanzas"
          className="text-text placeholder:text-text-tertiary min-h-[44px] flex-1 bg-transparent px-2 py-2 text-base outline-none sm:text-sm"
          autoFocus
          disabled={false}
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

function EmptyHints({ onPick }: { onPick: (q: string) => void }) {
  const hints = [
    'Cuál es mi saldo total ahora',
    'Cuánto gasté en restaurantes este mes',
    'Cómo van mis presupuestos',
    'Qué ha detectado Finanzia últimamente',
  ]
  return (
    <div className="flex flex-col gap-3 py-6">
      <p className="editorial text-text-secondary text-base italic">
        Pregúntame sobre saldos, gastos, presupuestos o lo que Finanzia ha
        detectado. Si propongo registrar algo, te lo pongo para confirmar.
      </p>
      <div className="flex flex-col gap-2">
        {hints.map((h) => (
          <button
            key={h}
            type="button"
            onClick={() => onPick(h)}
            className="border-border-default hover:bg-surface-hover text-text-secondary hover:text-text rounded-[8px] border px-3 py-2 text-left text-[13px] transition-colors"
          >
            {h}
          </button>
        ))}
      </div>
    </div>
  )
}

type UIMessageLike = ReturnType<typeof useChat>['messages'][number]
type MessagePart = UIMessageLike['parts'][number]

function MessageBubble({
  message,
  onConfirm,
}: {
  message: UIMessageLike
  onConfirm: () => void
}) {
  const isUser = message.role === 'user'

  return (
    <div className={cn('flex flex-col gap-2', isUser && 'items-end')}>
      {message.parts.map((part, idx) => (
        <MessagePartView
          key={`${message.id}-${idx}`}
          part={part}
          partKey={`${message.id}-${idx}`}
          isUser={isUser}
          onConfirm={onConfirm}
        />
      ))}
    </div>
  )
}

function MessagePartView({
  part,
  partKey,
  isUser,
  onConfirm,
}: {
  part: MessagePart
  partKey: string
  isUser: boolean
  onConfirm: () => void
}) {
  if (part.type === 'text') {
    return (
      <div
        className={cn(
          'max-w-[88%] rounded-[12px] px-3.5 py-2.5 text-sm leading-relaxed',
          isUser
            ? 'bg-surface-hover text-text'
            : 'text-text-secondary px-1 py-0',
        )}
      >
        <p className="whitespace-pre-wrap">{part.text}</p>
      </div>
    )
  }

  if (typeof part.type === 'string' && part.type.startsWith('tool-')) {
    return (
      <ToolPartView
        part={part as unknown as ToolPartLike}
        partKey={partKey}
        onConfirm={onConfirm}
      />
    )
  }

  return null
}

type ToolPartLike = {
  type: `tool-${string}`
  state?: string
  output?: unknown
  errorText?: string
}

function ToolPartView({
  part,
  partKey,
  onConfirm,
}: {
  part: ToolPartLike
  partKey: string
  onConfirm: () => void
}) {
  const toolName = part.type.replace(/^tool-/, '')
  const state = part.state
  const Spark = icons.sparkles

  // Tools propose-* con resultado: render confirmación.
  if (state === 'output-available') {
    const output = part.output
    if (toolName === 'proposeCreateTransaction' && isCreateProposal(output)) {
      return (
        <ProposalCard
          partKey={partKey}
          title="Propuesta: nueva transacción"
          summary={summarizeTxProposal(output)}
          onConfirm={async () => {
            const res = await confirmProposedTransaction({
              proposal: {
                kind: output.proposal.kind,
                accountId: output.proposal.accountId,
                transferAccountId: output.proposal.transferAccountId,
                categoryId: output.proposal.categoryId,
                date: output.proposal.date,
                amount: output.proposal.amount,
                currency: output.proposal.currency,
                description: output.proposal.description,
                merchant: output.proposal.merchant,
                notes: output.proposal.notes,
              },
            })
            if (!res.ok) {
              toast.error(res.error.message)
              return false
            }
            toast.success('Transacción registrada.')
            onConfirm()
            return true
          }}
        />
      )
    }
    if (toolName === 'proposeSetBudget' && isBudgetProposal(output)) {
      return (
        <ProposalCard
          partKey={partKey}
          title={
            output.proposal.mode === 'update'
              ? 'Propuesta: actualizar presupuesto'
              : 'Propuesta: nuevo presupuesto'
          }
          summary={summarizeBudgetProposal(output)}
          onConfirm={async () => {
            const res = await confirmProposedBudget({
              proposal: {
                mode: output.proposal.mode,
                existingBudgetId: output.proposal.existingBudgetId,
                categoryId: output.proposal.categoryId,
                amount: output.proposal.amount,
                period: output.proposal.period,
                rollover: output.proposal.rollover,
              },
            })
            if (!res.ok) {
              toast.error(res.error.message)
              return false
            }
            toast.success('Presupuesto guardado.')
            onConfirm()
            return true
          }}
        />
      )
    }
    // Read tools: render una insignia compacta — el LLM ya tradujo el dato a texto.
    return (
      <span className="text-text-tertiary inline-flex items-center gap-1 text-[11px]">
        <Spark
          strokeWidth={1.5}
          className="size-3"
          style={{ color: 'var(--accent-ai)' }}
        />
        consulta · {toolName}
      </span>
    )
  }

  if (state === 'input-streaming' || state === 'input-available') {
    return (
      <span className="text-text-tertiary inline-flex items-center gap-1 text-[11px]">
        <Spark
          strokeWidth={1.5}
          className="size-3 animate-pulse"
          style={{ color: 'var(--accent-ai)' }}
        />
        consultando · {toolName}…
      </span>
    )
  }

  if (state === 'output-error') {
    return (
      <span className="text-negative text-[11px]">
        Error en {toolName}: {part.errorText ?? 'desconocido'}
      </span>
    )
  }

  return null
}

function ProposalCard({
  partKey,
  title,
  summary,
  onConfirm,
}: {
  partKey: string
  title: string
  summary: Array<{ label: string; value: string }>
  onConfirm: () => Promise<boolean>
}) {
  const [state, setState] = useState<'idle' | 'pending' | 'confirmed' | 'dismissed'>(
    'idle',
  )

  async function doConfirm() {
    setState('pending')
    const ok = await onConfirm()
    setState(ok ? 'confirmed' : 'idle')
  }

  return (
    <article
      data-key={partKey}
      className="border-border-default bg-surface-elevated flex max-w-[88%] flex-col gap-3 rounded-[12px] border p-4"
    >
      <header className="flex items-center gap-2">
        <span
          className="size-1.5 rounded-full"
          style={{ backgroundColor: 'var(--accent-ai)' }}
          aria-hidden
        />
        <span className="text-text text-[13px] font-semibold">{title}</span>
      </header>
      <dl className="flex flex-col gap-1">
        {summary.map((s) => (
          <div key={s.label} className="flex items-baseline justify-between gap-3">
            <dt className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              {s.label}
            </dt>
            <dd className="text-text-secondary text-[13px]">{s.value}</dd>
          </div>
        ))}
      </dl>
      {state === 'idle' && (
        <div className="flex items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setState('dismissed')}
          >
            Descartar
          </Button>
          <Button type="button" size="sm" onClick={doConfirm}>
            Confirmar
          </Button>
        </div>
      )}
      {state === 'pending' && (
        <p className="text-text-tertiary text-right text-[11px]">Guardando…</p>
      )}
      {state === 'confirmed' && (
        <p className="text-positive text-right text-[11px]">Confirmado.</p>
      )}
      {state === 'dismissed' && (
        <p className="text-text-tertiary text-right text-[11px]">Descartado.</p>
      )}
    </article>
  )
}

// ---------- type guards y formateo ----------

type CreateProposal = {
  ok: true
  proposal: {
    kind: 'income' | 'expense' | 'transfer'
    accountId: string
    accountName: string
    accountCurrency: string
    transferAccountId: string | null
    transferAccountName: string | null
    categoryId: string | null
    categoryName: string | null
    date: string
    amount: string
    currency: string
    description: string
    merchant: string | null
    notes: string | null
  }
}

function isCreateProposal(o: unknown): o is CreateProposal {
  if (!o || typeof o !== 'object') return false
  const c = o as { ok?: unknown; proposal?: unknown }
  if (c.ok !== true) return false
  return (
    !!c.proposal &&
    typeof c.proposal === 'object' &&
    'accountId' in (c.proposal as Record<string, unknown>)
  )
}

function summarizeTxProposal(p: CreateProposal) {
  const out = [
    { label: 'Tipo', value: p.proposal.kind },
    {
      label: 'Cuenta',
      value:
        p.proposal.kind === 'transfer' && p.proposal.transferAccountName
          ? `${p.proposal.accountName} → ${p.proposal.transferAccountName}`
          : p.proposal.accountName,
    },
    { label: 'Monto', value: `${p.proposal.amount} ${p.proposal.currency}` },
    { label: 'Fecha', value: p.proposal.date },
    { label: 'Descripción', value: p.proposal.description },
  ]
  if (p.proposal.categoryName) {
    out.push({ label: 'Categoría', value: p.proposal.categoryName })
  }
  return out
}

type BudgetProposal = {
  ok: true
  proposal: {
    mode: 'create' | 'update'
    existingBudgetId: string | null
    categoryId: string
    categoryName: string
    amount: string
    period: 'monthly' | 'weekly' | 'yearly'
    rollover: boolean
  }
}

function isBudgetProposal(o: unknown): o is BudgetProposal {
  if (!o || typeof o !== 'object') return false
  const c = o as { ok?: unknown; proposal?: unknown }
  if (c.ok !== true) return false
  return (
    !!c.proposal &&
    typeof c.proposal === 'object' &&
    'period' in (c.proposal as Record<string, unknown>)
  )
}

function summarizeBudgetProposal(p: BudgetProposal) {
  return [
    { label: 'Categoría', value: p.proposal.categoryName },
    { label: 'Monto', value: p.proposal.amount },
    {
      label: 'Período',
      value:
        p.proposal.period === 'monthly'
          ? 'Mensual'
          : p.proposal.period === 'weekly'
            ? 'Semanal'
            : 'Anual',
    },
    {
      label: 'Rollover',
      value: p.proposal.rollover ? 'Sí (acumula sobrante)' : 'No',
    },
  ]
}
