'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'
import { MobileMoreSheet } from './mobile-more-sheet'
import { useDialogStore } from './dialog-store'

type NavItem = {
  label: string
  href: string
  icon: IconName
}

// 2 + FAB + 2. El FAB central abre directamente el dialog de nuevo
// movimiento — el flujo más común de la app.
const LEFT_ITEMS: NavItem[] = [
  { label: 'Hoy', href: '/dashboard', icon: 'home' },
  { label: 'Mi dinero', href: '/mi-dinero', icon: 'wallet' },
]

const RIGHT_ITEMS: NavItem[] = [
  { label: 'Mi plan', href: '/mi-plan', icon: 'target' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Bottom nav fijo para mobile (<md). Layout: Hoy / Mi dinero / FAB +
 * central / Mi plan / Más.
 *
 * El FAB central abre directamente NewTransactionDialog — el flujo más
 * común. Patrón fintech estándar (Cash App, Revolut, Wise): un solo gesto
 * para el acto que el usuario hace 20 veces al día.
 */
export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const openDialog = useDialogStore((s) => s.open)
  const More = icons['more-horizontal'] ?? icons.settings
  const Plus = icons.plus

  // Warmup eager de las rutas primarias al montar el bottom-nav. Next limita
  // el viewport-prefetch en conexiones lentas; este loop fuerza la descarga
  // del RSC (full prefetch) en cuanto la app es interactiva.
  useEffect(() => {
    for (const item of [...LEFT_ITEMS, ...RIGHT_ITEMS]) {
      router.prefetch(item.href)
    }
  }, [router])

  function renderNavItem(item: NavItem) {
    const Icon = icons[item.icon]
    const active = isActive(pathname, item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        onTouchStart={() => router.prefetch(item.href)}
        aria-current={active ? 'page' : undefined}
        aria-label={item.label}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors',
          active ? 'text-text' : 'text-text-tertiary',
        )}
      >
        <Icon
          strokeWidth={1.5}
          className={cn('size-[18px]', active && 'text-text')}
        />
        <span className="text-[10px] font-medium tracking-tight">
          {item.label}
        </span>
        {active && (
          <span
            aria-hidden
            className="absolute top-0 h-0.5 w-7 rounded-full"
            style={{ background: 'var(--brand-purple-strong)' }}
          />
        )}
      </Link>
    )
  }

  return (
    <>
      <nav
        aria-label="Navegación principal móvil"
        className="border-border-default bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {/* Inner row con altura fija — el safe-area inset queda en el
            <nav> outer como padding extra, no comprime los items. En
            standalone iOS la home indicator vive sobre el inset; el
            contenido se queda en sus 64px sanos. */}
        <div className="flex h-[64px] items-stretch">
          {LEFT_ITEMS.map(renderNavItem)}

          {/* FAB central — abre new-transaction. Encajado en la barra,
              centrado vertical. Tamaño 56px destaca por color, sin
              sobresalir verticalmente. */}
          <div className="flex w-[72px] shrink-0 items-center justify-center">
            <button
              type="button"
              onClick={() => openDialog('new-transaction')}
              aria-label="Registrar movimiento"
              className="active:scale-95 flex h-14 w-14 items-center justify-center rounded-full transition-transform"
              style={{
                background: 'var(--purple-base)',
                color: '#FFFFFF',
              }}
            >
              <Plus strokeWidth={2.5} className="size-6" />
            </button>
          </div>

          {RIGHT_ITEMS.map(renderNavItem)}

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            aria-label="Abrir más opciones"
            aria-haspopup="dialog"
            aria-expanded={moreOpen}
            className={cn(
              'relative flex flex-1 flex-col items-center justify-center gap-1 px-1 transition-colors',
              moreOpen ? 'text-text' : 'text-text-tertiary',
            )}
          >
            <More
              strokeWidth={1.5}
              className={cn('size-[18px]', moreOpen && 'text-text')}
            />
            <span className="text-[10px] font-medium tracking-tight">Más</span>
          </button>
        </div>
      </nav>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
