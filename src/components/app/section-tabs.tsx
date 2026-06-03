'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'

export type SectionTab = {
  label: string
  href: string
}

type Props = {
  tabs: SectionTab[]
  ariaLabel: string
}

/**
 * Tabs horizontales sticky bajo el topbar para las secciones posesivas
 * (Mi dinero / Mi plan / Mi historia). Scrollables en mobile.
 *
 * Cada tab es un <Link> con `aria-current="page"` cuando activa. Active state
 * tintado con el morado de marca (`--brand-purple-strong`) sutil, alineado con
 * el resto de la app (sidebar, mobile-nav indicator).
 */
export function SectionTabs({ tabs, ariaLabel }: Props) {
  const pathname = usePathname()

  return (
    <nav
      aria-label={ariaLabel}
      className="border-border-default bg-background sticky top-0 z-20 -mx-4 border-b sm:-mx-6 md:top-[var(--topbar-h)] lg:-mx-8"
    >
      <div className="mx-auto flex max-w-[1120px] [scrollbar-width:none] gap-1 overflow-x-auto px-2 [-ms-overflow-style:none] sm:px-4 lg:px-6 [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`)
          return (
            <Link
              key={tab.href}
              href={tab.href}
              prefetch
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative inline-flex h-11 shrink-0 items-center px-3 text-[13px] font-medium tracking-tight transition-colors',
                active ? 'text-text' : 'text-text-tertiary hover:text-text-secondary',
              )}
            >
              {tab.label}
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-3 bottom-0 h-[2px] rounded-full"
                  style={{ background: 'var(--brand-purple-strong)' }}
                />
              )}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
