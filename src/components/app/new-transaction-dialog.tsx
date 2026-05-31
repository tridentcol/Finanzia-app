'use client'

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { createTransaction } from '@/app/(app)/mi-dinero/movimientos/actions'
import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'
import { CategoryCombobox } from './category-combobox'
import { useDialogStore } from './dialog-store'

type AccountOption = {
  id: string
  name: string
  currency: string
  type: string
}

type CategoryOption = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  parentId: string | null
}

type Props = {
  accounts: AccountOption[]
  categories: CategoryOption[]
}

type Kind = 'expense' | 'income' | 'transfer'

const KIND_META: Record<
  Kind,
  { label: string; icon: keyof typeof icons; tone: string; sign: '−' | '+' | '⇆' }
> = {
  expense: { label: 'Gasto', icon: 'arrow-up', tone: 'text-negative', sign: '−' },
  income: { label: 'Ingreso', icon: 'arrow-down', tone: 'text-positive', sign: '+' },
  transfer: {
    label: 'Transferencia',
    icon: 'arrow-right-left',
    tone: 'text-text-secondary',
    sign: '⇆',
  },
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: 'Corriente',
  savings: 'Ahorros',
  credit_card: 'Tarjeta',
  cash: 'Efectivo',
  investment: 'Inversión',
  crypto: 'Cripto',
  other: 'Otra',
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function relativeDateLabel(iso: string): string {
  const today = todayIso()
  if (iso === today) return 'Hoy'
  const t = new Date(`${today}T00:00:00Z`).getTime()
  const d = new Date(`${iso}T00:00:00Z`).getTime()
  const days = Math.round((t - d) / (1000 * 60 * 60 * 24))
  if (days === 1) return 'Ayer'
  if (days > 0 && days < 7) return `Hace ${days} días`
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export function NewTransactionDialog({ accounts, categories }: Props) {
  const active = useDialogStore((s) => s.active)
  const payload = useDialogStore((s) => s.payload)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-transaction'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <NewTransactionForm
          accounts={accounts}
          categories={categories}
          presetKind={(payload as { kind?: Kind } | null)?.kind}
          presetAccountId={(payload as { accountId?: string } | null)?.accountId}
          onDone={close}
        />
      )}
    </Dialog>
  )
}

function NewTransactionForm({
  accounts,
  categories,
  presetKind,
  presetAccountId,
  onDone,
}: Props & {
  presetKind?: Kind
  presetAccountId?: string
  onDone: () => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [showAdvanced, setShowAdvanced] = useState(false)

  // State directo en lugar de react-hook-form — el form es lo bastante simple
  // y queremos máxima velocidad y control de los chips/quick-actions.
  const [kind, setKind] = useState<Kind>(presetKind ?? 'expense')
  const initialAccount =
    accounts.find((a) => a.id === presetAccountId)?.id ?? accounts[0]?.id ?? ''
  const [accountId, setAccountId] = useState(initialAccount)
  const [transferAccountId, setTransferAccountId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [date, setDate] = useState(todayIso())
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [notes, setNotes] = useState('')

  // Auto-focus en el monto al abrir — es lo primero que se llena.
  const amountRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    amountRef.current?.focus()
  }, [])

  const account = accounts.find((a) => a.id === accountId)
  const transferOptions = accounts.filter((a) => a.id !== accountId)
  const eligibleCategories = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  )

  // Si cambian kind y la categoría ya no aplica, derivamos la categoría
  // "efectiva" sin setState: si el id seleccionado no está en las
  // elegibles para el kind actual, lo tratamos como vacío en el render.
  // Cuando el usuario elija una nueva categoría, el state pisa esto.
  const effectiveCategoryId =
    categoryId && eligibleCategories.some((c) => c.id === categoryId)
      ? categoryId
      : ''

  const isCreditCard = account?.type === 'credit_card'
  const meta = KIND_META[kind]

  function reset() {
    setAmount('')
    setDescription('')
    setNotes('')
    setShowAdvanced(false)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    if (!account) {
      setServerError('Selecciona una cuenta.')
      return
    }
    if (!amount || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setServerError('Monto inválido. Usa formato 1234 o 1234.56.')
      return
    }
    if (!description.trim()) {
      setServerError('Escribe una descripción.')
      return
    }
    if (kind === 'transfer' && !transferAccountId) {
      setServerError('Elige la cuenta destino de la transferencia.')
      return
    }

    startTransition(async () => {
      const result = await createTransaction({
        kind,
        accountId,
        transferAccountId: kind === 'transfer' ? transferAccountId : null,
        categoryId: effectiveCategoryId || null,
        date,
        amountOriginal: amount,
        currency: account.currency as 'COP',
        description: description.trim(),
        merchant: null,
        notes: notes.trim() || null,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }
      toast.success('Movimiento registrado.')
      router.refresh()
      reset()
      onDone()
    })
  }

  if (accounts.length === 0) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Necesitas una cuenta primero</DialogTitle>
          <DialogDescription>
            Registra una cuenta o tarjeta antes de asentar movimientos. La
            cuenta es donde se asienta la plata; el movimiento solo tiene
            sentido referido a una.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onDone}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>Nuevo movimiento</DialogTitle>
        <DialogDescription className="sr-only">
          Registra un movimiento. Cantidad, cuenta, descripción.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Hero: monto grande + signo según tipo */}
        <div className="border-border-default/60 bg-surface-hover/40 flex items-baseline justify-center gap-2 rounded-[12px] border px-4 py-5">
          <span
            className={cn('amount text-2xl tabular leading-none', meta.tone)}
            aria-hidden
          >
            {meta.sign}
          </span>
          <input
            ref={amountRef}
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0"
            aria-label="Monto"
            className="amount text-text placeholder:text-text-tertiary w-full max-w-[260px] bg-transparent text-center text-[44px] leading-none font-semibold tabular outline-none"
          />
          <span className="text-text-tertiary text-[12px] tabular leading-none">
            {account?.currency ?? ''}
          </span>
        </div>

        {/* Tipo: 3 chips */}
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(KIND_META) as Kind[]).map((k) => {
            const m = KIND_META[k]
            const Icon = icons[m.icon]
            const selected = kind === k
            return (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                aria-pressed={selected}
                className={cn(
                  'flex h-10 items-center justify-center gap-2 rounded-[8px] border text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40',
                  selected
                    ? 'border-border-emphasis bg-surface-hover text-text'
                    : 'border-border-default text-text-secondary hover:text-text hover:bg-surface-hover/60',
                )}
              >
                <Icon strokeWidth={1.5} className={cn('size-[14px]', selected ? m.tone : '')} />
                {m.label}
              </button>
            )
          })}
        </div>

        {/* Cuenta + destino/categoría */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              {kind === 'transfer' ? 'Desde' : isCreditCard ? 'Tarjeta' : 'Cuenta'}
            </label>
            <CategoryCombobox
              options={accounts.map((a) => ({
                id: a.id,
                name: a.name,
                subtitle: `${ACCOUNT_TYPE_LABEL[a.type] ?? a.type} · ${a.currency}`,
              }))}
              value={accountId}
              onChange={setAccountId}
              placeholder="Cuenta"
              emptyLabel="Cuenta"
            />
          </div>

          {kind === 'transfer' ? (
            <div className="flex flex-col gap-1.5">
              <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                Hacia
              </label>
              <CategoryCombobox
                options={transferOptions.map((a) => ({
                  id: a.id,
                  name: a.name,
                  subtitle: `${ACCOUNT_TYPE_LABEL[a.type] ?? a.type} · ${a.currency}`,
                }))}
                value={transferAccountId}
                onChange={setTransferAccountId}
                placeholder="Cuenta destino"
                emptyLabel="Cuenta destino"
              />
            </div>
          ) : (
            <div className="flex flex-col gap-1.5">
              <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                Categoría
              </label>
              <CategoryCombobox
                options={eligibleCategories.map((c) => ({
                  id: c.id,
                  name: c.name,
                }))}
                value={effectiveCategoryId}
                onChange={setCategoryId}
                disabled={eligibleCategories.length === 0}
                placeholder={
                  eligibleCategories.length === 0
                    ? 'Sin categorías'
                    : 'Sin categorizar'
                }
                emptyLabel="Sin categorizar"
              />
            </div>
          )}
        </div>

        {/* Aviso contextual para tarjetas */}
        {isCreditCard && kind === 'expense' && (
          <p className="text-text-tertiary border-border-default/60 bg-surface-hover/30 rounded-[8px] border px-3 py-2 text-[12px] leading-relaxed">
            Esta compra reducirá el cupo disponible de tu tarjeta y se reflejará
            como deuda hasta que pagues el extracto.
          </p>
        )}

        {/* Descripción */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="tx-description" className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Descripción
          </label>
          <Input
            id="tx-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mercado del sábado"
          />
        </div>

        {/* Fecha quick-chips */}
        <div className="flex flex-col gap-1.5">
          <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Fecha · {relativeDateLabel(date)}
          </label>
          <div className="flex items-center gap-2">
            <div className="flex gap-1">
              {[
                { label: 'Hoy', value: todayIso() },
                { label: 'Ayer', value: shiftDate(todayIso(), -1) },
                { label: '-3d', value: shiftDate(todayIso(), -3) },
              ].map((opt) => {
                const selected = opt.value === date
                return (
                  <button
                    key={opt.label}
                    type="button"
                    onClick={() => setDate(opt.value)}
                    className={cn(
                      'inline-flex min-h-11 items-center justify-center rounded-[6px] px-2.5 py-1 text-[12px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40 sm:min-h-0',
                      selected
                        ? 'bg-surface-hover text-text'
                        : 'text-text-secondary hover:bg-surface-hover/60',
                    )}
                  >
                    {opt.label}
                  </button>
                )
              })}
            </div>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="tabular ml-auto h-9 w-[150px] text-[12px]"
            />
          </div>
        </div>

        {/* Avanzado: notas */}
        {showAdvanced ? (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="tx-notes" className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Notas
            </label>
            <Textarea
              id="tx-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Contexto opcional"
              rows={3}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowAdvanced(true)}
            className="text-text-tertiary hover:text-text-secondary self-start rounded-[6px] text-[12px] underline-offset-2 transition-colors outline-none hover:underline focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40"
          >
            + Agregar notas
          </button>
        )}

        {serverError && (
          <p className="text-negative text-[12px]">{serverError}</p>
        )}

        <DialogFooter className="sm:gap-2">
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : `Registrar ${KIND_META[kind].label.toLowerCase()}`}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
