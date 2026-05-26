'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

import { icons } from '@/lib/design/icons'

type Props = { initialCount: number }

/**
 * Badge sutil de alertas. Polling cada 60s para reflejar nuevas alertas que
 * el cron pueda generar mientras el usuario está activo. Click → /ajustes/alertas.
 *
 * `initialCount` evita un flash de "sin alertas" en la primera render — se
 * resuelve server-side.
 */
export function AlertsBell({ initialCount }: Props) {
  const [count, setCount] = useState(initialCount)
  const Bell = icons.bell

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch('/api/alerts/count', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as { count: number }
        if (!cancelled) setCount(json.count ?? 0)
      } catch {
        // network ruido — ignorar.
      }
    }
    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return (
    <Link
      href="/ajustes/alertas"
      aria-label={`Alertas (${count} sin leer)`}
      className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text relative flex h-9 items-center justify-center rounded-[8px] border px-2 transition-colors"
    >
      <Bell strokeWidth={1.5} className="size-[14px]" />
      {count > 0 && (
        <span
          aria-hidden
          className="absolute right-1 top-1 grid size-3.5 place-items-center rounded-full text-[9px] font-semibold text-black"
          style={{ background: 'var(--accent-ai)' }}
        >
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Link>
  )
}
