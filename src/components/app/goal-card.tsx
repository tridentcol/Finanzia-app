'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Amount } from './amount'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { adjustGoalProgress, archiveGoal } from '@/app/(app)/metas/actions'
import type { GoalWithProgress } from '@/lib/db/queries/goals'
import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'
import type { CurrencyCode } from '@/lib/currency/currencies'

type Props = { goal: GoalWithProgress }

export function GoalCard({ goal }: Props) {
  const router = useRouter()
  const [contributing, setContributing] = useState(false)
  const [delta, setDelta] = useState('')
  const [pending, startTransition] = useTransition()
  const Target = icons.target

  const percentClamped = Math.min(1, Math.max(0, goal.percent))
  const remaining = (
    Number.parseFloat(goal.targetAmount) - Number.parseFloat(goal.currentAmount)
  ).toFixed(2)

  function onAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!delta) return
    startTransition(async () => {
      const res = await adjustGoalProgress({ id: goal.id, delta })
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      toast.success('Aporte registrado.')
      setDelta('')
      setContributing(false)
      router.refresh()
    })
  }

  function onArchive() {
    if (!confirm('Abandonar esta meta?')) return
    startTransition(async () => {
      const res = await archiveGoal(goal.id)
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      router.refresh()
    })
  }

  const statusLabel =
    goal.status === 'completed'
      ? 'Cumplida'
      : goal.daysToTarget !== null && goal.daysToTarget < 0
        ? 'Vencida'
        : goal.daysToTarget !== null
          ? `${goal.daysToTarget} días`
          : 'Sin fecha'

  return (
    <article className="border-border-default bg-surface flex min-w-0 flex-col gap-3 rounded-[12px] border p-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Target
            strokeWidth={1.5}
            className="text-text-tertiary size-4 shrink-0"
          />
          <span className="text-text truncate text-[14px] font-semibold">{goal.name}</span>
        </div>
        <span className="text-text-tertiary shrink-0 text-[11px]">{statusLabel}</span>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
        <Amount value={goal.currentAmount} currency={goal.currency as CurrencyCode} className="text-base" />
        <span className="text-text-tertiary text-[11px]">
          de <Amount value={goal.targetAmount} currency={goal.currency as CurrencyCode} className="inline text-[11px]" /> · faltan{' '}
          <Amount value={remaining} currency={goal.currency as CurrencyCode} className="inline text-[11px]" />
        </span>
      </div>

      <div className="bg-surface-hover relative h-1.5 w-full overflow-hidden rounded-full">
        <div
          aria-hidden
          className={cn(
            'h-full rounded-full transition-all',
            goal.status === 'completed' ? 'bg-positive' : 'bg-text',
          )}
          style={{ width: `${percentClamped * 100}%` }}
        />
      </div>

      {goal.linkedAccountName && (
        <p className="text-text-tertiary text-[11px]">
          Vinculada a {goal.linkedAccountName}
        </p>
      )}

      <div className="flex items-center justify-between gap-2 pt-1">
        {contributing ? (
          <form onSubmit={onAdd} className="flex flex-1 items-center gap-2">
            <Input
              inputMode="decimal"
              placeholder="0.00"
              className="tabular h-8"
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              autoFocus
            />
            <Button type="submit" size="sm" disabled={pending || !delta}>
              {pending ? '…' : 'Sumar'}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setContributing(false)
                setDelta('')
              }}
            >
              Cancelar
            </Button>
          </form>
        ) : (
          <>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setContributing(true)}
              disabled={goal.status === 'completed'}
            >
              Aportar
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onArchive}>
              Abandonar
            </Button>
          </>
        )}
      </div>
    </article>
  )
}
