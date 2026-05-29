'use client'

import { useEffect } from 'react'

/**
 * Detecta si la app corre como PWA instalada (standalone) y refleja el modo
 * en `<html data-standalone="true">`. Permite overrides puntuales en CSS o
 * componentes sin tener que volver a evaluar matchMedia en cada lugar.
 *
 * - iOS Safari standalone: `display-mode: standalone` o `navigator.standalone`.
 * - Android/desktop instalado: `display-mode: standalone`.
 *
 * No renderiza nada. Limpia el atributo y el listener al desmontar.
 */
export function StandaloneDetector() {
  useEffect(() => {
    const mql = window.matchMedia('(display-mode: standalone)')

    function apply() {
      const iosStandalone =
        'standalone' in window.navigator &&
        (window.navigator as Navigator & { standalone?: boolean }).standalone === true
      const isStandalone = mql.matches || iosStandalone
      document.documentElement.dataset.standalone = isStandalone ? 'true' : 'false'
    }

    apply()
    mql.addEventListener('change', apply)
    return () => mql.removeEventListener('change', apply)
  }, [])

  return null
}
