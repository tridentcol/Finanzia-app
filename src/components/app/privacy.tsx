'use client'

import { createContext, useCallback, useContext, useSyncExternalStore } from 'react'

type PrivacyValue = { hidden: boolean; toggle: () => void }

// Default sin proveedor: nunca oculto. Así `Amount` fuera de un PrivacyProvider
// (el resto de la app) se comporta exactamente igual que antes.
const PrivacyContext = createContext<PrivacyValue>({ hidden: false, toggle: () => {} })

export function usePrivacy(): PrivacyValue {
  return useContext(PrivacyContext)
}

// Estado en una cookie de SESIÓN (sin expires → se borra al cerrar el tab). El
// servidor la lee para el render inicial (initialHidden), evitando el flash de
// saldos reales al recargar con privacidad activa. No toca el perfil ni la DB.
export const PRIVACY_COOKIE = 'fz_hide_balances'
const listeners = new Set<() => void>()

function readCookie(): boolean {
  if (typeof document === 'undefined') return false
  return document.cookie.split('; ').includes(`${PRIVACY_COOKIE}=1`)
}

function writeCookie(next: boolean): void {
  if (typeof document === 'undefined') return
  document.cookie = `${PRIVACY_COOKIE}=${next ? '1' : '0'}; path=/; samesite=lax`
  for (const l of listeners) l()
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/**
 * Modo privacidad de su subárbol (hoy: el dashboard). Oculta los saldos sólo en
 * la sesión del tab, sin persistir en el perfil ni afectar a otras páginas.
 * `initialHidden` viene del servidor (lectura de la cookie) → SSR ya enmascara,
 * sin flash. `useSyncExternalStore` evita el setState-en-effect (React Compiler)
 * y el mismatch de hidratación.
 *
 * El enmascarado es por CSS: marca `data-balances-hidden` en un wrapper
 * `display:contents` (sin caja, no altera el layout) y globals.css enmascara todo
 * `.amount` descendiente. Así Amount sigue siendo server y CUALQUIER monto del
 * subárbol se oculta sin tocar cada componente — escalable por defecto.
 */
export function PrivacyProvider({
  initialHidden = false,
  children,
}: {
  initialHidden?: boolean
  children: React.ReactNode
}) {
  const hidden = useSyncExternalStore(subscribe, readCookie, () => initialHidden)
  const toggle = useCallback(() => writeCookie(!readCookie()), [])
  return (
    <PrivacyContext.Provider value={{ hidden, toggle }}>
      <div className="contents" data-balances-hidden={hidden ? '' : undefined}>
        {children}
      </div>
    </PrivacyContext.Provider>
  )
}
