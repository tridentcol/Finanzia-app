'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Command } from 'cmdk'
import { Dialog } from 'radix-ui'

import { icons } from '@/lib/design/icons'
import { useCommandStore } from './command-store'
import { useDialogStore, type AppDialogId } from './dialog-store'

type NavItem = {
  label: string
  href: string
  icon: keyof typeof icons
  // Aliases de búsqueda — incluyen los nombres viejos para que "ir a
  // transacciones" siga resolviendo a la nueva ruta `/mi-dinero/movimientos`.
  keywords?: string
  shortcut?: string
}

// Cmd+K resuelve todas las sub-tabs por nombre directo. Las rutas viejas
// (transacciones, ahorro, etc.) viven como aliases en `keywords` para
// preservar el muscle-memory.
const navigation: NavItem[] = [
  { label: 'Ir a Hoy', href: '/dashboard', icon: 'home', shortcut: 'G H', keywords: 'resumen dashboard inicio' },

  // Mi dinero
  { label: 'Ir a Cuentas', href: '/mi-dinero/cuentas', icon: 'wallet', shortcut: 'G C' },
  { label: 'Ir a Tarjetas', href: '/mi-dinero/tarjetas', icon: 'credit-card', keywords: 'tarjetas crédito visa mastercard cupo corte' },
  { label: 'Ir a Movimientos', href: '/mi-dinero/movimientos', icon: 'list', shortcut: 'G M', keywords: 'transacciones bitácora' },
  { label: 'Ir a Deudas', href: '/mi-dinero/deudas', icon: 'landmark', keywords: 'préstamos hipoteca' },

  // Mi plan
  { label: 'Ir a Presupuestos', href: '/mi-plan/presupuestos', icon: 'target' },
  { label: 'Ir a Metas', href: '/mi-plan/metas', icon: 'piggy-bank' },
  { label: 'Ir a Ahorro', href: '/mi-plan/ahorro', icon: 'trending-up' },
  { label: 'Ir a Cash flow', href: '/mi-plan/cash-flow', icon: 'trending-down', keywords: 'flujo caja' },
  { label: 'Ir a Recurrentes', href: '/mi-plan/recurrentes', icon: 'repeat', keywords: 'recurring suscripciones recordatorios' },

  // Mi historia
  { label: 'Ir a Insights', href: '/mi-historia/insights', icon: 'sparkles', keywords: 'lecturas' },
  { label: 'Ir a Informes', href: '/mi-historia/informes', icon: 'book-open', keywords: 'reportes mensuales' },

  // Globales
  { label: 'Importar CSV', href: '/mi-dinero/movimientos?import=open', icon: 'upload', keywords: 'csv extracto bancario importar' },
  { label: 'Ajustes', href: '/ajustes', icon: 'settings' },
  { label: 'Categorías', href: '/ajustes#categorias', icon: 'tag', keywords: 'categorias categorías sistema custom' },
  { label: 'Alertas', href: '/ajustes#alertas', icon: 'bell', keywords: 'notificaciones bandeja' },
  { label: 'Integraciones IA', href: '/ajustes#integraciones-ia', icon: 'sparkles', keywords: 'anthropic openai claves' },
  { label: 'Perfil financiero', href: '/ajustes#perfil', icon: 'user', keywords: 'moneda locale plan ahorro' },
]

export function CommandPalette() {
  const router = useRouter()
  const open = useCommandStore((s) => s.open)
  const setOpen = useCommandStore((s) => s.setOpen)
  const toggle = useCommandStore((s) => s.toggle)
  const openDialog = useDialogStore((s) => s.open)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 'k') {
        e.preventDefault()
        toggle()
        return
      }
      if (key === 'j') {
        e.preventDefault()
        setOpen(false)
        setTimeout(() => openDialog('copilot'), 0)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [toggle, setOpen, openDialog])

  function runNavigate(href: string) {
    setOpen(false)
    router.push(href)
  }

  function runOpenDialog(id: AppDialogId) {
    setOpen(false)
    // Pequeño delay para que el cierre del cmdk no compita con la apertura del dialog.
    setTimeout(() => openDialog(id), 50)
  }

  const Ai = icons.sparkles
  const Plus = icons.plus
  const Wallet = icons.wallet
  const Tag = icons.tag
  const Target = icons.target
  const Upload = icons.upload
  const Calendar = icons.calendar

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="border-border-default bg-surface fixed z-50 overflow-hidden border shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 inset-x-3 top-3 bottom-3 rounded-[14px] sm:inset-auto sm:left-1/2 sm:top-[20vh] sm:bottom-auto sm:w-[640px] sm:max-w-[calc(100vw-32px)] sm:-translate-x-1/2 sm:rounded-[16px] data-[state=closed]:sm:zoom-out-95 data-[state=open]:sm:zoom-in-95"
        >
          <Dialog.Title className="sr-only">Buscar y navegar</Dialog.Title>
          <Command label="Paleta de comandos" className="flex flex-col">
            <div className="border-border-default flex items-center gap-3 border-b px-4">
              <span className="text-text-tertiary">
                {(() => {
                  const Search = icons.search
                  return <Search strokeWidth={1.5} className="h-[16px] w-[16px]" />
                })()}
              </span>
              <Command.Input
                placeholder="Buscar o saltar a…"
                className="text-text placeholder:text-text-tertiary flex-1 bg-transparent py-4 text-[15px] outline-none"
              />
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto py-2">
              <Command.Empty className="text-text-tertiary px-4 py-8 text-center text-sm">
                Sin resultados.
              </Command.Empty>

              <Command.Group
                heading="Acciones"
                className="[&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em]"
              >
                <Command.Item
                  value="Nueva transacción registrar movimiento"
                  onSelect={() => runOpenDialog('new-transaction')}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  <Plus strokeWidth={1.5} className="h-[15px] w-[15px]" />
                  <span className="flex-1">Nueva transacción</span>
                  <span className="text-text-tertiary text-[11px] tracking-wider">N T</span>
                </Command.Item>
                <Command.Item
                  value="Nueva cuenta agregar checking savings"
                  onSelect={() => runOpenDialog('new-account')}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  <Wallet strokeWidth={1.5} className="h-[15px] w-[15px]" />
                  <span className="flex-1">Nueva cuenta</span>
                  <span className="text-text-tertiary text-[11px] tracking-wider">N C</span>
                </Command.Item>
                <Command.Item
                  value="Nueva tarjeta de crédito cupo corte"
                  onSelect={() => runOpenDialog('new-card')}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  {(() => {
                    const CC = icons['credit-card']
                    return <CC strokeWidth={1.5} className="h-[15px] w-[15px]" />
                  })()}
                  <span className="flex-1">Nueva tarjeta</span>
                </Command.Item>
                <Command.Item
                  value="Nueva categoría crear"
                  onSelect={() => runOpenDialog('new-category')}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  <Tag strokeWidth={1.5} className="h-[15px] w-[15px]" />
                  <span className="flex-1">Nueva categoría</span>
                </Command.Item>
                <Command.Item
                  value="Nuevo presupuesto crear tope"
                  onSelect={() => runOpenDialog('new-budget')}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  <Target strokeWidth={1.5} className="h-[15px] w-[15px]" />
                  <span className="flex-1">Nuevo presupuesto</span>
                </Command.Item>
                <Command.Item
                  value="Importar CSV extracto bancario"
                  onSelect={() => runNavigate('/mi-dinero/movimientos?import=open')}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  <Upload strokeWidth={1.5} className="h-[15px] w-[15px]" />
                  <span className="flex-1">Importar CSV</span>
                </Command.Item>
                <Command.Item
                  value="Resumen del día movimientos hoy diario"
                  onSelect={() => {
                    const today = new Date().toISOString().slice(0, 10)
                    runNavigate(`/mi-dinero/movimientos?day=${today}`)
                  }}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  <Calendar strokeWidth={1.5} className="h-[15px] w-[15px]" />
                  <span className="flex-1">Resumen de hoy</span>
                </Command.Item>
              </Command.Group>

              <Command.Group
                heading="Ir a"
                className="[&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em]"
              >
                {navigation.map((item) => {
                  const Icon = icons[item.icon]
                  // cmdk filtra contra `value` — concatenamos label + keywords
                  // para que aliases viejos (transacciones, ahorro, etc.) sigan
                  // resolviendo.
                  const value = item.keywords
                    ? `${item.label} ${item.keywords}`
                    : item.label
                  return (
                    <Command.Item
                      key={item.href}
                      value={value}
                      onSelect={() => runNavigate(item.href)}
                      className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                    >
                      <Icon strokeWidth={1.5} className="h-[15px] w-[15px]" />
                      <span className="flex-1">{item.label}</span>
                      {item.shortcut && (
                        <span className="text-text-tertiary text-[11px] tracking-wider">
                          {item.shortcut}
                        </span>
                      )}
                    </Command.Item>
                  )
                })}
              </Command.Group>

              <Command.Group
                heading="Inteligencia"
                className="mt-2 [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em] [&_[cmdk-group-heading]]:text-[color:var(--accent-ai)]"
              >
                <Command.Item
                  value="Preguntar a Finanzia copiloto IA"
                  onSelect={() => runOpenDialog('copilot')}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  <Ai
                    strokeWidth={1.5}
                    className="h-[15px] w-[15px]"
                    style={{ color: 'var(--accent-ai)' }}
                  />
                  <span className="flex-1">Preguntar a Finanzia</span>
                  <span className="text-text-tertiary text-[11px] tracking-wider">⌘ J</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
