'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ViewTransition } from 'react'

import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

type RailItem = {
  label: string
  href: string
  icon: IconName
}

const primary: RailItem[] = [
  { label: 'Resumen', href: '/dashboard', icon: 'home' },
  { label: 'Cuentas', href: '/cuentas', icon: 'wallet' },
  { label: 'Transacciones', href: '/transacciones', icon: 'list' },
  { label: 'Categorías', href: '/categorias', icon: 'tag' },
  { label: 'Presupuestos', href: '/presupuestos', icon: 'target' },
  { label: 'Metas', href: '/metas', icon: 'piggy-bank' },
  { label: 'Insights', href: '/insights', icon: 'sparkles' },
]

const secondary: RailItem[] = [
  { label: 'Ajustes', href: '/ajustes', icon: 'settings' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function RailLink({ item, active }: { item: RailItem; active: boolean }) {
  const Icon = icons[item.icon]
  return (
    <Link
      href={item.href}
      aria-label={item.label}
      aria-current={active ? 'page' : undefined}
      className="group relative flex h-12 items-center justify-center"
    >
      <span
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md transition-colors duration-150',
          active
            ? 'text-text bg-surface-hover'
            : 'text-text-tertiary hover:text-text-secondary hover:bg-surface-hover/60',
        )}
      >
        <Icon strokeWidth={1.5} className="h-[18px] w-[18px]" />
      </span>

      {active && (
        <ViewTransition name="rail-indicator">
          <span
            aria-hidden
            className="bg-text absolute top-1/2 left-0 h-5 w-[2px] -translate-y-1/2 rounded-r-full"
          />
        </ViewTransition>
      )}

      <span
        role="tooltip"
        className={cn(
          'border-border-default bg-surface-elevated text-text pointer-events-none absolute left-[calc(100%+12px)] top-1/2 z-50 -translate-y-1/2 whitespace-nowrap rounded-md border px-2.5 py-1 text-xs opacity-0 transition-opacity duration-150 delay-300',
          'group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        {item.label}
      </span>
    </Link>
  )
}

export function Rail() {
  const pathname = usePathname()

  return (
    <aside
      aria-label="Navegación principal"
      className="border-border-default bg-surface fixed inset-y-0 left-0 z-40 flex w-[56px] flex-col border-r"
    >
      <div className="flex h-14 items-center justify-center">
        <Link href="/dashboard" aria-label="Finanzia" className="block">
          <span className="text-text text-[15px] font-semibold tracking-tight">
            F
          </span>
        </Link>
      </div>
      <nav className="flex flex-1 flex-col items-stretch gap-1 py-2">
        {primary.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
      <nav className="flex flex-col items-stretch gap-1 pb-3">
        {secondary.map((item) => (
          <RailLink key={item.href} item={item} active={isActive(pathname, item.href)} />
        ))}
      </nav>
    </aside>
  )
}
