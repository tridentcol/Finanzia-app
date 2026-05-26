'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

type NavItem = {
  label: string
  href: string
  icon: IconName
}

type NavSection = {
  id: string
  label: string
  items: NavItem[]
}

const SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Visión general',
    items: [{ label: 'Resumen', href: '/dashboard', icon: 'home' }],
  },
  {
    id: 'operation',
    label: 'Operación',
    items: [
      { label: 'Cuentas', href: '/cuentas', icon: 'wallet' },
      { label: 'Transacciones', href: '/transacciones', icon: 'list' },
      { label: 'Importar', href: '/importar', icon: 'upload' },
      { label: 'Categorías', href: '/categorias', icon: 'tag' },
      { label: 'Presupuestos', href: '/presupuestos', icon: 'target' },
      { label: 'Metas', href: '/metas', icon: 'piggy-bank' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Inteligencia',
    items: [{ label: 'Insights', href: '/insights', icon: 'sparkles' }],
  },
]

const FOOTER_ITEMS: NavItem[] = [
  { label: 'Ajustes', href: '/ajustes', icon: 'settings' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = icons[item.icon]
  return (
    <Link
      href={item.href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group relative flex h-9 items-center gap-3 rounded-[8px] px-2.5 text-[13px] transition-colors duration-150',
        active
          ? 'text-text bg-surface-hover'
          : 'text-text-secondary hover:text-text hover:bg-surface-hover/60',
      )}
    >
      <Icon
        strokeWidth={1.5}
        className={cn('size-[16px] shrink-0', active ? 'text-text' : 'text-text-tertiary group-hover:text-text-secondary')}
      />
      <span className="flex-1 truncate">{item.label}</span>
      {active && (
        <span
          aria-hidden
          className="size-1 rounded-full"
          style={{ background: 'var(--accent-ai)' }}
        />
      )}
    </Link>
  )
}

/**
 * Sidebar 240px para desktop (>=lg). Secciones agrupadas con labels sutiles,
 * brand mark arriba y bloque de usuario abajo. Esconde en mobile —
 * `MobileNav` la reemplaza con bottom-nav.
 */
export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside
      aria-label="Navegación principal"
      className="border-border-default bg-surface fixed inset-y-0 left-0 z-40 hidden w-[240px] flex-col border-r lg:flex"
    >
      <div className="border-border-default flex h-14 items-center gap-2 border-b px-4">
        <Link href="/dashboard" aria-label="Finanzia" className="flex items-center gap-2">
          <span
            aria-hidden
            className="grid size-6 place-items-center rounded-[6px]"
            style={{ background: 'var(--accent-ai)' }}
          >
            <span className="text-[13px] font-semibold text-black">F</span>
          </span>
          <span className="text-text text-[14px] font-semibold tracking-tight">
            Finanzia
          </span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-2.5 py-4">
        {SECTIONS.map((section) => (
          <div key={section.id} className="flex flex-col gap-1">
            <span className="text-text-tertiary px-2 text-[10px] uppercase tracking-[0.1em]">
              {section.label}
            </span>
            <div className="flex flex-col gap-0.5">
              {section.items.map((item) => (
                <NavLink
                  key={item.href}
                  item={item}
                  active={isActive(pathname, item.href)}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-border-default border-t px-2.5 py-3">
        <div className="flex flex-col gap-0.5">
          {FOOTER_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              active={isActive(pathname, item.href)}
            />
          ))}
        </div>
        <div className="mt-3 flex items-center gap-3 rounded-[8px] px-2.5 py-2">
          <UserButton
            appearance={{
              elements: { avatarBox: 'size-7' },
            }}
          />
          <span className="text-text-secondary truncate text-[12px]">Tu cuenta</span>
        </div>
      </div>
    </aside>
  )
}
