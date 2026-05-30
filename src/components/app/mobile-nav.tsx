'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'
import { useDialogStore } from './dialog-store'

type NavItem = {
  label: string
  href: string
  icon: IconName
}

// 4 secciones posesivas + FAB central. El FAB es el COPILOTO (presencia de IA):
// el atajo a "preguntar a Finanzia" desde cualquier pantalla. Registrar
// movimiento subió al cluster del topbar.
const LEFT_ITEMS: NavItem[] = [
  { label: 'Hoy', href: '/dashboard', icon: 'home' },
  { label: 'Mi dinero', href: '/mi-dinero', icon: 'wallet' },
]

const RIGHT_ITEMS: NavItem[] = [
  { label: 'Mi plan', href: '/mi-plan', icon: 'target' },
  { label: 'Mi historia', href: '/mi-historia', icon: 'book-open' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Bottom nav fijo para mobile (<md). Layout: Hoy / Mi dinero / [◆ Copiloto] /
 * Mi plan / Mi historia.
 *
 * El FAB central abre el copiloto — único elemento con color (lavanda
 * `accent-ai`, uso canónico = presencia de IA). No es una ruta: nunca lleva
 * indicador de activo. Patrón fintech (Cash App, Revolut): un gesto al pulgar
 * para el acto central de la app.
 */
export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const openDialog = useDialogStore((s) => s.open)
  const Spark = icons.sparkles

  // Warmup eager de las 4 rutas primarias al montar — Next limita el
  // viewport-prefetch en conexiones lentas.
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
        <Icon strokeWidth={1.5} className={cn('size-[18px]', active && 'text-text')} />
        <span className="w-full truncate text-center text-[10px] font-medium tracking-tight">
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
    <nav
      aria-label="Navegación principal móvil"
      className="border-border-default bg-surface/95 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-md md:hidden"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
    >
      {/* Inner row con altura fija — el safe-area inset queda como padding del
          <nav> outer, no comprime los items (home indicator iOS standalone). */}
      <div className="flex h-[var(--mobile-nav-h)] items-stretch">
        {LEFT_ITEMS.map(renderNavItem)}

        {/* FAB central — abre el copiloto. Lavanda accent-ai (presencia de IA),
            56px encajado, sin sombra/glow (eso violaría el mandato). Icono
            oscuro para contraste sobre el lavanda (igual que el badge de
            alertas). */}
        <div className="flex w-[72px] shrink-0 items-center justify-center">
          <button
            type="button"
            onClick={() => openDialog('copilot')}
            aria-label="Preguntar a Finanzia"
            aria-haspopup="dialog"
            className="flex h-14 w-14 items-center justify-center rounded-full transition-transform motion-safe:active:scale-95"
            style={{ background: 'var(--accent-ai)', color: '#0A0A0B' }}
          >
            <Spark strokeWidth={2} className="size-6" />
          </button>
        </div>

        {RIGHT_ITEMS.map(renderNavItem)}
      </div>
    </nav>
  )
}
