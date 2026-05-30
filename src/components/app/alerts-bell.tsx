'use client'

import Link from 'next/link'

import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

/**
 * Badge de alertas (desktop). Conteo controlado por el caller (Topbar, vía
 * `useUnreadAlerts`) para no duplicar el polling con el badge del avatar mobile.
 * Click → bandeja accionable en /ajustes#alertas.
 */
export function AlertsBell({ count, className }: { count: number; className?: string }) {
  const Bell = icons.bell

  return (
    <Link
      href="/ajustes#alertas"
      aria-label={`Alertas (${count} sin leer)`}
      className={cn(
        'border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text relative flex h-9 w-9 items-center justify-center rounded-[8px] border transition-colors',
        className,
      )}
    >
      <Bell strokeWidth={1.5} className="size-[14px]" />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute right-1 top-1 grid size-3.5 place-items-center rounded-full text-[9px] font-semibold text-white"
          style={{ background: 'var(--brand-purple-strong)' }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
