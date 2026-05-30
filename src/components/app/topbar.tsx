'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'

import { icons } from '@/lib/design/icons'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { BrandMark } from '@/components/brand/brand-mark'
import { useCommandStore } from './command-store'
import { useDialogStore } from './dialog-store'
import { AlertsBell } from './alerts-bell'
import { MobileAccountSheet } from './mobile-account-sheet'

type TitleEntry = { match: string; section: string; sub?: string }

// Las rutas dentro de las secciones posesivas componen el título como
// "Sección · Sub-tab". Orden importa: las más específicas primero.
const ENTRIES: TitleEntry[] = [
  { match: '/dashboard', section: 'Hoy' },

  { match: '/mi-dinero/cuentas', section: 'Mi dinero', sub: 'Cuentas' },
  { match: '/mi-dinero/tarjetas', section: 'Mi dinero', sub: 'Tarjetas' },
  { match: '/mi-dinero/deudas', section: 'Mi dinero', sub: 'Deudas' },
  { match: '/mi-dinero/cash-flow', section: 'Mi dinero', sub: 'Cash flow' },
  { match: '/mi-dinero/movimientos', section: 'Mi dinero', sub: 'Movimientos' },
  { match: '/mi-dinero', section: 'Mi dinero' },

  { match: '/mi-plan/presupuestos', section: 'Mi plan', sub: 'Presupuestos' },
  { match: '/mi-plan/metas', section: 'Mi plan', sub: 'Metas' },
  { match: '/mi-plan/ahorro', section: 'Mi plan', sub: 'Ahorro' },
  { match: '/mi-plan/recurrentes', section: 'Mi plan', sub: 'Recurrentes' },
  { match: '/mi-plan', section: 'Mi plan' },

  { match: '/mi-historia/insights', section: 'Mi historia', sub: 'Insights' },
  { match: '/mi-historia/informes', section: 'Mi historia', sub: 'Informes' },
  { match: '/mi-historia', section: 'Mi historia' },

  { match: '/importar', section: 'Importar' },
  { match: '/ajustes', section: 'Ajustes' },
]

function resolveTitle(pathname: string): string {
  const hit = ENTRIES.find(
    (e) => pathname === e.match || pathname.startsWith(`${e.match}/`),
  )
  if (!hit) return 'Finanzia'
  return hit.sub ? `${hit.section} · ${hit.sub}` : hit.section
}

/**
 * Topbar adaptable.
 *  - >=md: SidebarTrigger (toggle del shadcn sidebar) + título.
 *  - <md: brand mark Finanzia + título compacto (no hay sidebar, hay
 *    MobileNav fijo abajo).
 */
export function Topbar({ unreadAlerts = 0 }: { unreadAlerts?: number }) {
  const pathname = usePathname()
  const title = resolveTitle(pathname)
  const setOpen = useCommandStore((s) => s.setOpen)
  const openDialog = useDialogStore((s) => s.open)
  const [accountOpen, setAccountOpen] = useState(false)
  const Search = icons.search
  const Command = icons.command
  const Spark = icons.sparkles
  const Plus = icons.plus
  const UserIcon = icons.user

  return (
    <>
      <header className="border-border-default bg-background sticky top-0 z-30 flex min-h-[var(--topbar-h)] items-center justify-between gap-2 border-b px-4 pt-[var(--safe-top)] md:gap-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <SidebarTrigger className="-ml-1 hidden md:inline-flex" />
          <BrandMark size={22} className="shrink-0 md:hidden" />
          <h1 className="text-text truncate text-[14px] font-semibold tracking-tight lg:text-[15px]">
            {title}
          </h1>
        </div>

        {/* Cluster de acciones. Touch targets ≥44px en mobile (h-11 w-11),
            h-9 en desktop. El copiloto NO está aquí en mobile (es el FAB del
            bottom-nav); Registrar (marca) sí. */}
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <AlertsBell initialCount={unreadAlerts} />

          {/* Registrar movimiento — acción primaria de marca (morado). */}
          <button
            type="button"
            onClick={() => openDialog('new-transaction')}
            aria-label="Registrar movimiento"
            className="inline-flex h-11 w-11 items-center justify-center rounded-[8px] text-sm font-medium transition-colors md:h-9 md:w-auto md:gap-2 md:px-2.5"
            style={{ background: 'var(--purple-base)', color: '#FFFFFF' }}
          >
            <Plus strokeWidth={2} className="size-[18px] md:size-[14px]" />
            <span className="hidden lg:inline">Registrar</span>
          </button>

          {/* Preguntar — sólo desktop; en mobile el copiloto es el FAB central. */}
          <button
            type="button"
            onClick={() => openDialog('copilot')}
            aria-label="Preguntar a Finanzia"
            className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text hidden h-9 items-center gap-2 rounded-[8px] border px-2 text-sm transition-colors md:inline-flex lg:px-2.5"
          >
            <Spark strokeWidth={1.5} className="size-[14px]" style={{ color: 'var(--accent-ai)' }} />
            <span className="hidden lg:inline">Preguntar</span>
          </button>

          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Buscar"
            className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text flex h-11 w-11 items-center justify-center rounded-[8px] border text-sm transition-colors md:h-9 md:w-auto md:gap-2 md:px-2 lg:pr-1.5 lg:pl-2.5"
          >
            <Search strokeWidth={1.5} className="size-[18px] md:size-[14px]" />
            <span className="hidden lg:inline">Buscar</span>
            <span className="border-border-default text-text-tertiary ml-6 hidden items-center gap-0.5 rounded border px-1.5 py-0.5 text-[11px] lg:flex">
              <Command strokeWidth={1.5} className="size-[10px]" />K
            </span>
          </button>

          {/* Avatar — sólo mobile: puerta a config + sesión (Sheet bottom). En
              desktop la cuenta vive en el pie del sidebar. */}
          <button
            type="button"
            onClick={() => setAccountOpen(true)}
            aria-label="Tu cuenta y ajustes"
            aria-haspopup="dialog"
            className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text flex h-11 w-11 items-center justify-center rounded-[8px] border transition-colors md:hidden"
          >
            <UserIcon strokeWidth={1.5} className="size-[18px]" />
          </button>
        </div>
      </header>

      <MobileAccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
    </>
  )
}
