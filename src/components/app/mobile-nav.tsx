'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'
import { MobileMoreSheet } from './mobile-more-sheet'

type NavItem = {
  label: string
  href: string
  icon: IconName
}

const ITEMS: NavItem[] = [
  { label: 'Resumen', href: '/dashboard', icon: 'home' },
  { label: 'Cuentas', href: '/cuentas', icon: 'wallet' },
  { label: 'Bitácora', href: '/transacciones', icon: 'list' },
  { label: 'Insights', href: '/insights', icon: 'sparkles' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

/**
 * Bottom nav fijo para mobile (<md). 4 items primarios + "Más" abre sheet
 * con resto de secciones (importar, categorías, presupuestos, metas, ajustes
 * y subpáginas). El AppSidebar shadcn se desmonta en mobile.
 *
 * Patrón estándar fintech (Mercury, Revolut, Wise): pulgar alcanza la base,
 * destinos clave siempre visibles, jerarquía obvia. `safe-area-inset-bottom`
 * respeta el home indicator de iOS.
 */
export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const [moreOpen, setMoreOpen] = useState(false)
  const More = icons['more-horizontal'] ?? icons.settings

  // Warmup eager de las 4 rutas primarias al montar el bottom-nav. Next
  // limita el viewport-prefetch en conexiones lentas; este loop fuerza la
  // descarga del RSC (full prefetch) en cuanto la app es interactiva.
  useEffect(() => {
    for (const item of ITEMS) {
      router.prefetch(item.href)
    }
  }, [router])

  return (
    <>
      <nav
        aria-label="Navegación principal móvil"
        className="border-border-default bg-surface/95 fixed inset-x-0 bottom-0 z-40 flex h-[58px] items-stretch border-t backdrop-blur-md md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        {ITEMS.map((item) => {
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
        })}
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
      </nav>
      <MobileMoreSheet open={moreOpen} onOpenChange={setMoreOpen} />
    </>
  )
}
