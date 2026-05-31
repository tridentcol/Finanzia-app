'use client'

import { icons } from '@/lib/design/icons'
import { usePrivacy } from './privacy'

/**
 * Botón discreto para ocultar/mostrar los saldos del dashboard (modo privacidad
 * de sesión). Ojo = visible; ojo tachado = oculto. Vive dentro de un
 * PrivacyProvider.
 */
export function HideBalancesToggle() {
  const { hidden, toggle } = usePrivacy()
  const Icon = hidden ? icons['eye-off'] : icons.eye

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      aria-label={hidden ? 'Mostrar saldos' : 'Ocultar saldos'}
      className="text-text-tertiary hover:text-text -m-1.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-[6px] p-1.5 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40 sm:min-h-0 sm:min-w-0"
    >
      <Icon strokeWidth={1.5} className="size-4" />
    </button>
  )
}
