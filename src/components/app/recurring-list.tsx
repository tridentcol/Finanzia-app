'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  deleteRecurringRule,
  runRecurringNow,
  toggleRecurringRule,
} from '@/app/(app)/ajustes/recurring/actions'
import type { RecurringRuleListItem } from '@/lib/db/queries/recurring'
import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

const freqLabel: Record<RecurringRuleListItem['frequency'], string> = {
  daily: 'Diaria',
  weekly: 'Semanal',
  biweekly: 'Quincenal',
  monthly: 'Mensual',
  quarterly: 'Trimestral',
  yearly: 'Anual',
}

export function RecurringList({ rules }: { rules: RecurringRuleListItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const Repeat = icons.repeat

  function onToggle(id: string) {
    startTransition(async () => {
      const res = await toggleRecurringRule(id)
      if (!res.ok) toast.error(res.error.message)
      router.refresh()
    })
  }

  function onDelete(id: string) {
    if (!confirm('Eliminar esta regla?')) return
    startTransition(async () => {
      const res = await deleteRecurringRule(id)
      if (!res.ok) toast.error(res.error.message)
      router.refresh()
    })
  }

  function onRunNow() {
    startTransition(async () => {
      const res = await runRecurringNow()
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      const { processed, created } = res.data
      if (processed === 0) {
        toast.message('Sin reglas vencidas.')
      } else {
        toast.success(`${created} de ${processed} ejecutadas.`)
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-text-secondary text-[13px]">
          {rules.filter((r) => r.active).length} activas · {rules.length} total
        </span>
        <Button variant="outline" size="sm" onClick={onRunNow} disabled={pending}>
          Procesar vencidas
        </Button>
      </div>

      <ul className="flex flex-col gap-2">
        {rules.map((r) => (
          <li
            key={r.id}
            className={cn(
              'border-border-default bg-surface flex min-w-0 flex-col gap-3 rounded-[12px] border p-4 sm:flex-row sm:items-start sm:justify-between',
              !r.active && 'opacity-60',
            )}
          >
            <div className="flex min-w-0 items-start gap-3">
              <Repeat
                strokeWidth={1.5}
                className={cn(
                  'mt-0.5 size-4 shrink-0',
                  r.kind === 'income' ? 'text-positive' : 'text-text-tertiary',
                )}
              />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-text truncate text-sm font-semibold">{r.description}</span>
                <span className="text-text-tertiary text-[11px]">
                  {freqLabel[r.frequency]} · {r.kind === 'income' ? 'Ingreso' : 'Gasto'} de {r.amount} {r.currency}
                </span>
                <span className="text-text-tertiary text-[11px]">
                  {r.accountName ?? '—'}
                  {r.categoryName ? ` · ${r.categoryName}` : ''}
                  {r.nextRun ? ` · próxima ${r.nextRun}` : ''}
                  {!r.autoCreate ? ' · pide confirmación' : ''}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1 sm:self-start">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onToggle(r.id)}
                disabled={pending}
              >
                {r.active ? 'Pausar' : 'Activar'}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(r.id)}
                disabled={pending}
              >
                Eliminar
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
