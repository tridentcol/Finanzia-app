'use client'

import { useEffect, useState } from 'react'

/**
 * Conteo de alertas sin leer, con polling cada 60s. Arranca del valor resuelto
 * en el server (sin flash de "0"). Una sola fuente para el badge del avatar
 * (mobile) y la campana (desktop), así no se duplica el polling.
 */
export function useUnreadAlerts(initial: number): number {
  const [count, setCount] = useState(initial)

  useEffect(() => {
    let cancelled = false
    async function tick() {
      try {
        const res = await fetch('/api/alerts/count', { cache: 'no-store' })
        if (!res.ok) return
        const json = (await res.json()) as { count: number }
        if (!cancelled) setCount(json.count ?? 0)
      } catch {
        // ruido de red — ignorar.
      }
    }
    const id = window.setInterval(tick, 60_000)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [])

  return count
}
