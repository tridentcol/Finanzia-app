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
  shortcut?: string
}

const navigation: NavItem[] = [
  { label: 'Ir a Resumen', href: '/dashboard', icon: 'home', shortcut: 'G R' },
  { label: 'Ir a Cuentas', href: '/cuentas', icon: 'wallet', shortcut: 'G C' },
  { label: 'Ir a Transacciones', href: '/transacciones', icon: 'list', shortcut: 'G T' },
  { label: 'Ir a Categorías', href: '/categorias', icon: 'tag' },
  { label: 'Ir a Presupuestos', href: '/presupuestos', icon: 'target' },
  { label: 'Ir a Metas', href: '/metas', icon: 'piggy-bank' },
  { label: 'Ir a Insights', href: '/insights', icon: 'sparkles' },
  { label: 'Ajustes', href: '/ajustes', icon: 'settings' },
]

export function CommandPalette() {
  const router = useRouter()
  const open = useCommandStore((s) => s.open)
  const setOpen = useCommandStore((s) => s.setOpen)
  const toggle = useCommandStore((s) => s.toggle)
  const openDialog = useDialogStore((s) => s.open)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [toggle])

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

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="border-border-default bg-surface fixed left-1/2 top-[20vh] z-50 w-[640px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-[16px] border shadow-2xl data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
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
                  value="Nueva cuenta agregar"
                  onSelect={() => runOpenDialog('new-account')}
                  className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-2 flex h-9 cursor-pointer items-center gap-3 rounded-md px-2 text-sm transition-colors"
                >
                  <Wallet strokeWidth={1.5} className="h-[15px] w-[15px]" />
                  <span className="flex-1">Nueva cuenta</span>
                  <span className="text-text-tertiary text-[11px] tracking-wider">N C</span>
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
              </Command.Group>

              <Command.Group
                heading="Ir a"
                className="[&_[cmdk-group-heading]]:text-text-tertiary [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.08em]"
              >
                {navigation.map((item) => {
                  const Icon = icons[item.icon]
                  return (
                    <Command.Item
                      key={item.href}
                      value={item.label}
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
                  value="Preguntar a Finanzia"
                  disabled
                  className="text-text-secondary aria-selected:bg-surface-hover data-[disabled=true]:opacity-50 mx-2 flex h-9 cursor-not-allowed items-center gap-3 rounded-md px-2 text-sm"
                >
                  <Ai
                    strokeWidth={1.5}
                    className="h-[15px] w-[15px]"
                    style={{ color: 'var(--accent-ai)' }}
                  />
                  <span className="flex-1">Preguntar a Finanzia</span>
                  <span className="text-text-tertiary text-[11px]">próximamente</span>
                </Command.Item>
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
