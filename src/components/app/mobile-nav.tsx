'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  /** Destino real (NO el root que redirige). Apuntar al landing concreto hace
   *  que `prefetch` precargue el RSC con datos → navegación instantánea. Un href
   *  a `/mi-dinero` (redirect 308) solo prefetchea el redirect, no el dato. */
  href: string
  /** Prefijo de sección para el estado activo (todas las sub-rutas lo comparten). */
  section: string
  icon: IconName
}

// 4 secciones posesivas + FAB central. El FAB es el COPILOTO (presencia de IA):
// el atajo a "preguntar a Finanzia" desde cualquier pantalla. Registrar
// movimiento subió al cluster del topbar.
const LEFT_ITEMS: NavItem[] = [
  { label: 'Hoy', href: '/dashboard', section: '/dashboard', icon: 'home' },
  { label: 'Mi dinero', href: '/mi-dinero/cuentas', section: '/mi-dinero', icon: 'wallet' },
]

const RIGHT_ITEMS: NavItem[] = [
  { label: 'Mi plan', href: '/mi-plan/presupuestos', section: '/mi-plan', icon: 'target' },
  {
    label: 'Mi historia',
    href: '/mi-historia/insights',
    section: '/mi-historia',
    icon: 'book-open',
  },
]

function isActive(pathname: string, section: string): boolean {
  if (section === '/dashboard') return pathname === '/dashboard'
  return pathname === section || pathname.startsWith(`${section}/`)
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
    const active = isActive(pathname, item.section)
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        onTouchStart={() => router.prefetch(item.href)}
        aria-current={active ? 'page' : undefined}
        aria-label={item.label}
        className={cn(
          'relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 transition-colors',
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

  // En NAVEGADOR (base) la barra es `fixed bottom-0` (el body scrollea). En PWA
  // instalada (`standalone:`) deja de ser fixed y pasa a ser el último item de
  // la columna-shell (`static shrink-0`) → pegada al borde inferior sin depender
  // de position:fixed/safe-area (que iOS rompe). Fondo sólido (sin backdrop-blur,
  // que iOS repinta mal). El safe-area inferior (home indicator) va como
  // padding-bottom; la fila de items tiene altura fija dentro.
  return (
    <nav
      aria-label="Navegación principal móvil"
      className="border-border-default bg-surface standalone:max-md:static standalone:max-md:shrink-0 fixed inset-x-0 bottom-0 z-40 border-t md:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Inner row con altura fija — el safe-area inset queda como padding del
          <nav> outer, no comprime los items (home indicator iOS standalone). */}
      <div className="flex h-[var(--mobile-nav-h)] items-stretch">
        {LEFT_ITEMS.map(renderNavItem)}

        {/* FAB central — abre el copiloto. Lavanda accent-ai (presencia de IA),
            encajado en la barra compacta, sin sombra/glow (eso violaría el
            mandato). Icono oscuro para contraste sobre el lavanda (igual que el
            badge de alertas). */}
        <div className="flex w-[64px] shrink-0 items-center justify-center">
          <Link
            href="/copilot"
            prefetch
            aria-label="Preguntar a Finanzia"
            className="flex h-12 w-12 items-center justify-center rounded-full transition-transform motion-safe:active:scale-95"
            style={{ background: 'var(--accent-ai)', color: '#0A0A0B' }}
          >
            <Spark strokeWidth={2} className="size-5" />
          </Link>
        </div>

        {RIGHT_ITEMS.map(renderNavItem)}
      </div>
    </nav>
  )
}
