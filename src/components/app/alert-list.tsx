'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  deleteAlert,
  markAlertRead,
  markAllAlertsRead,
} from '@/app/(app)/ajustes/alertas/actions'
import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'
import type { AlertListItem } from '@/lib/db/queries/alerts'

const kindLabel: Record<AlertListItem['kind'], string> = {
  unusual_spend: 'Gasto inusual',
  budget_exceeded: 'Presupuesto en riesgo',
  recurring_due: 'Recurring por vencer',
  low_balance: 'Saldo bajo',
  goal_at_risk: 'Meta en riesgo',
}

export function AlertList({ alerts }: { alerts: AlertListItem[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const unread = alerts.filter((a) => !a.read).length
  const X = icons.x
  const Bell = icons.bell

  function onRead(id: string) {
    startTransition(async () => {
      const res = await markAlertRead(id)
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      router.refresh()
    })
  }

  function onDelete(id: string) {
    startTransition(async () => {
      const res = await deleteAlert(id)
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      router.refresh()
    })
  }

  function onMarkAllRead() {
    startTransition(async () => {
      const res = await markAllAlertsRead()
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-[13px]">
          {unread} sin leer · {alerts.length} total
        </span>
        {unread > 0 && (
          <Button variant="outline" size="sm" onClick={onMarkAllRead} disabled={pending}>
            Marcar todas
          </Button>
        )}
      </div>
      <ul className="flex flex-col gap-2">
        {alerts.map((a) => (
          <li
            key={a.id}
            className={cn(
              'border-border-default bg-surface group flex items-start justify-between gap-3 rounded-[12px] border p-4',
              !a.read && 'ring-1 ring-[color:var(--accent-ai)]/30',
            )}
          >
            <div className="flex items-start gap-3">
              <Bell
                strokeWidth={1.5}
                className={cn(
                  'mt-0.5 size-4',
                  a.read ? 'text-text-tertiary' : 'text-text',
                )}
              />
              <div className="flex flex-col gap-1">
                <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                  {kindLabel[a.kind]}
                </span>
                <p className={cn('text-sm', a.read ? 'text-text-secondary' : 'text-text')}>
                  {a.message}
                </p>
                <span className="text-text-tertiary text-[11px]">
                  {a.createdAt.toLocaleString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {!a.read && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onRead(a.id)}
                  disabled={pending}
                >
                  Leída
                </Button>
              )}
              <button
                type="button"
                onClick={() => onDelete(a.id)}
                disabled={pending}
                aria-label="Eliminar"
                className="text-text-tertiary hover:text-text -m-1 rounded-[6px] p-1 transition-colors"
              >
                <X strokeWidth={1.5} className="size-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
