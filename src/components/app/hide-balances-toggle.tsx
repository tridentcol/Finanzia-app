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
      className="text-text-tertiary hover:text-text -m-1.5 rounded-[6px] p-1.5 transition-colors"
    >
      <Icon strokeWidth={1.5} className="size-4" />
    </button>
  )
}
