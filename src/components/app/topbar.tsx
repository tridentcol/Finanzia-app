'use client'

import { UserButton } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

import { icons } from '@/lib/design/icons'
import { useCommandStore } from './command-store'

const titles: Record<string, string> = {
  '/dashboard': 'Resumen',
  '/cuentas': 'Cuentas',
  '/transacciones': 'Transacciones',
  '/categorias': 'Categorías',
  '/presupuestos': 'Presupuestos',
  '/metas': 'Metas',
  '/insights': 'Insights',
  '/ajustes': 'Ajustes',
}

function resolveTitle(pathname: string): string {
  if (titles[pathname]) return titles[pathname]
  const match = Object.keys(titles).find(
    (key) => key !== '/' && pathname.startsWith(`${key}/`),
  )
  return match ? titles[match]! : 'Finanzia'
}

export function Topbar() {
  const pathname = usePathname()
  const title = resolveTitle(pathname)
  const setOpen = useCommandStore((s) => s.setOpen)
  const Search = icons.search
  const Command = icons.command

  return (
    <header className="border-border-default bg-background sticky top-0 z-30 flex h-14 items-center justify-between gap-4 border-b pr-4 pl-6">
      <h1 className="text-text text-[15px] font-semibold tracking-tight">
        {title}
      </h1>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text flex h-9 items-center gap-2 rounded-md border pr-1.5 pl-2.5 text-sm transition-colors duration-150"
        >
          <Search strokeWidth={1.5} className="h-[14px] w-[14px]" />
          <span>Buscar</span>
          <span className="border-border-default text-text-tertiary ml-6 flex items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px]">
            <Command strokeWidth={1.5} className="h-[10px] w-[10px]" />K
          </span>
        </button>
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: { width: '28px', height: '28px' },
            },
          }}
        />
      </div>
    </header>
  )
}
