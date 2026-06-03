'use client'

import { useEffect, useRef } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'

/**
 * Scroll al inicio cuando cambia la ruta. Sin esto, navegar entre sub-tabs
 * conserva la altura del scroll anterior — el usuario aparece "scrolleado"
 * en la nueva sección.
 *
 * Usa `smooth` cuando hay reduced-motion=ok; sino instantáneo.
 *
 * Excluye cambios que solo afectan searchParams del MISMO pathname — eso
 * suele ser navegación interna (filtros, etc.) y no queremos saltar al
 * top en esos casos.
 */
export function ScrollToTop() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const prevPathname = useRef(pathname)

  useEffect(() => {
    if (typeof window === 'undefined') return

    // Solo dispara cuando cambió el pathname (no cuando solo cambia query).
    if (pathname === prevPathname.current) return
    prevPathname.current = pathname

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth'
    // En mobile el scroller es `#main-content` (el body no scrollea, ver layout);
    // en desktop scrollea el window. Reseteamos ambos: el que no aplique es no-op.
    document.getElementById('main-content')?.scrollTo({ top: 0, left: 0, behavior })
    window.scrollTo({ top: 0, left: 0, behavior })
    // searchParams en deps para satisfacer el linter; el check anterior
    // garantiza que solo actuamos cuando cambió el path.
  }, [pathname, searchParams])

  return null
}
