'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton, useUser } from '@clerk/nextjs'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { icons } from '@/lib/design/icons'
import { useCommandStore } from './command-store'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  unread?: number
}

const ROW =
  'text-text-secondary hover:bg-surface-hover/60 hover:text-text flex min-h-[44px] items-center gap-3 rounded-[8px] px-2.5 text-left text-[14px] transition-colors'

/**
 * Perfil en mobile (<md): un Sheet bottom bajo el avatar del topbar. Tres
 * accesos limpios — Búsqueda, Notificaciones y Ajustes — más la sesión (Clerk
 * UserButton). Categorías / Integraciones IA / Importar NO van aquí: ya viven
 * dentro de Ajustes y del command palette (búsqueda). Cubre la safe-area abajo.
 */
export function MobileAccountSheet({ open, onOpenChange, unread = 0 }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const prevPath = useRef(pathname)
  const openSearch = useCommandStore((s) => s.setOpen)
  const { user } = useUser()

  // Cierra en un cambio REAL de ruta (al tocar un Link o el botón atrás).
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname
      onOpenChange(false)
    }
  }, [pathname, onOpenChange])

  useEffect(() => {
    if (open) router.prefetch('/ajustes')
  }, [open, router])

  const Search = icons.search
  const Bell = icons.bell
  const Settings = icons.settings
  const Chevron = icons['chevron-right']
  const UserIcon = icons.user

  const avatarUrl = user?.imageUrl
  const displayName =
    user?.fullName ?? user?.firstName ?? user?.primaryEmailAddress?.emailAddress ?? 'Tu cuenta'
  const email = user?.primaryEmailAddress?.emailAddress

  function handleSearch() {
    onOpenChange(false)
    // Diferir la apertura del command palette: cerrar este Sheet y montar otro
    // radix Dialog en el mismo tick haría competir sus focus-traps (foco perdido
    // del cmdk, scroll-lock huérfano). Patrón ya usado en command-palette.tsx.
    setTimeout(() => openSearch(true), 50)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" aria-describedby={undefined} className="md:hidden">
        <SheetHeader>
          <SheetTitle className="sr-only">Tu perfil</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1 px-2 pb-2">
          {/* Cabecera: avatar + nombre */}
          <div className="mb-2 flex items-center gap-3 px-1">
            {avatarUrl ? (
              <span
                role="img"
                aria-label=""
                className="size-11 shrink-0 rounded-full bg-cover bg-center"
                style={{ backgroundImage: `url(${avatarUrl})` }}
              />
            ) : (
              <span className="border-border-default bg-surface-elevated text-text-secondary flex size-11 shrink-0 items-center justify-center rounded-full border">
                <UserIcon strokeWidth={1.5} className="size-5" />
              </span>
            )}
            <div className="flex min-w-0 flex-col">
              <span className="text-text truncate text-[15px] font-medium">{displayName}</span>
              {email && <span className="text-text-tertiary truncate text-[12px]">{email}</span>}
            </div>
          </div>

          <button type="button" onClick={handleSearch} className={ROW} aria-label="Búsqueda">
            <Search strokeWidth={1.5} className="text-text-tertiary size-[18px] shrink-0" />
            <span className="flex-1">Búsqueda</span>
            <Chevron strokeWidth={1.5} className="text-text-tertiary size-4 shrink-0" />
          </button>

          <Link
            href="/ajustes#alertas"
            prefetch
            onClick={() => onOpenChange(false)}
            className={ROW}
            aria-label={`Notificaciones${unread > 0 ? ` (${unread} sin leer)` : ''}`}
          >
            <Bell strokeWidth={1.5} className="text-text-tertiary size-[18px] shrink-0" />
            <span className="flex-1">Notificaciones</span>
            {unread > 0 ? (
              <span
                className="grid min-w-5 place-items-center rounded-full px-1 text-[11px] font-semibold text-white"
                style={{ background: 'var(--brand-purple-strong)' }}
              >
                {unread > 9 ? '9+' : unread}
              </span>
            ) : (
              <Chevron strokeWidth={1.5} className="text-text-tertiary size-4 shrink-0" />
            )}
          </Link>

          <Link
            href="/ajustes"
            prefetch
            onClick={() => onOpenChange(false)}
            className={ROW}
            aria-label="Ajustes"
          >
            <Settings strokeWidth={1.5} className="text-text-tertiary size-[18px] shrink-0" />
            <span className="flex-1">Ajustes</span>
            <Chevron strokeWidth={1.5} className="text-text-tertiary size-4 shrink-0" />
          </Link>

          <div className="border-border-default mt-3 flex items-center gap-3 border-t px-1 pt-4">
            <UserButton appearance={{ elements: { avatarBox: 'size-9' } }} />
            <span className="text-text-secondary text-[13px]">Gestiona tu sesión</span>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
