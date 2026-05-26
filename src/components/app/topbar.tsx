'use client'

import { UserButton } from '@clerk/nextjs'
import { usePathname } from 'next/navigation'

import { icons } from '@/lib/design/icons'
import { useCommandStore } from './command-store'
import { useDialogStore } from './dialog-store'
import { AlertsBell } from './alerts-bell'

const titles: Record<string, string> = {
  '/dashboard': 'Resumen',
  '/cuentas': 'Cuentas',
  '/transacciones': 'Transacciones',
  '/importar': 'Importar',
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

/**
 * Topbar adaptable.
 *  - >=lg: título a la izquierda + buscador estilo Linear + ⌘K + ⌘J + avatar.
 *  - <lg: brand mark + título compacto + botón buscador icon-only + spark IA.
 */
export function Topbar({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname()
  const title = resolveTitle(pathname)
  const setOpen = useCommandStore((s) => s.setOpen)
  const openDialog = useDialogStore((s) => s.open)
  const Search = icons.search
  const Command = icons.command
  const Spark = icons.sparkles

  return (
    <header className="border-border-default bg-background sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b px-4 lg:px-6">
      <div className="flex items-center gap-2.5 lg:hidden">
        <span
          aria-hidden
          className="grid size-6 place-items-center rounded-[6px]"
          style={{ background: 'var(--accent-ai)' }}
        >
          <span className="text-[12px] font-semibold text-black">F</span>
        </span>
        <h1 className="text-text text-[14px] font-semibold tracking-tight">
          {title}
        </h1>
      </div>
      <h1 className="text-text hidden text-[15px] font-semibold tracking-tight lg:block">
        {title}
      </h1>

      <div className="flex items-center gap-2">
        <AlertsBell initialCount={unreadAlerts} />
        <button
          type="button"
          onClick={() => openDialog('copilot')}
          aria-label="Preguntar a Finanzia"
          className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text flex h-9 items-center gap-2 rounded-[8px] border px-2 text-sm transition-colors lg:px-2.5"
        >
          <Spark
            strokeWidth={1.5}
            className="size-[14px]"
            style={{ color: 'var(--accent-ai)' }}
          />
          <span className="hidden lg:inline">Preguntar</span>
        </button>

        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Buscar"
          className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text flex h-9 items-center gap-2 rounded-[8px] border px-2 text-sm transition-colors lg:pr-1.5 lg:pl-2.5"
        >
          <Search strokeWidth={1.5} className="size-[14px]" />
          <span className="hidden lg:inline">Buscar</span>
          <span className="border-border-default text-text-tertiary ml-6 hidden items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] lg:flex">
            <Command strokeWidth={1.5} className="size-[10px]" />K
          </span>
        </button>

        <div className="lg:hidden">
          <UserButton
            appearance={{
              elements: {
                userButtonAvatarBox: { width: '28px', height: '28px' },
              },
            }}
          />
        </div>
      </div>
    </header>
  )
}
