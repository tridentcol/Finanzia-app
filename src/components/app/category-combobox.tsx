'use client'

import { useState } from 'react'
import { Popover } from 'radix-ui'
import { Command } from 'cmdk'

import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

type Option = { id: string; name: string }

type Props = {
  options: Option[]
  /** id seleccionado o '' para "sin categoría". */
  value: string
  onChange: (next: string) => void
  /** Label que se ve en el trigger cuando no hay seleccionado. */
  placeholder?: string
  /** Label especial para la opción "sin categoría". */
  emptyLabel?: string
  disabled?: boolean
}

/**
 * Select de categoría con buscador. Reemplaza al `<Select>` de Radix
 * cuando hay muchas opciones — escribir filtra en vivo, evita el scroll
 * largo. Mismo styling de trigger.
 *
 * Implementación: Radix Popover + cmdk. La cmdk hace el filtrado fuzzy
 * por sus propios `value` props.
 */
export function CategoryCombobox({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar',
  emptyLabel = 'Sin categorizar',
  disabled = false,
}: Props) {
  const [open, setOpen] = useState(false)
  const ChevronDown = icons['chevron-down']
  const Check = icons.check
  const Search = icons.search

  const selected = options.find((o) => o.id === value) ?? null
  const triggerLabel = selected?.name ?? (value === '' ? emptyLabel : placeholder)

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        type="button"
        disabled={disabled}
        className={cn(
          'border-border-default bg-surface hover:bg-surface-hover/60 text-text flex h-10 w-full items-center justify-between gap-2 rounded-[8px] border px-3 text-sm outline-none transition-colors',
          'focus-visible:ring-accent-ai/40 focus-visible:ring-2',
          'disabled:opacity-50',
          value === '' && !selected ? 'text-text-tertiary' : 'text-text',
        )}
      >
        <span className="truncate">{triggerLabel}</span>
        <ChevronDown
          strokeWidth={1.5}
          className="text-text-tertiary size-4 shrink-0"
        />
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="start"
          sideOffset={6}
          className="border-border-default bg-surface-elevated z-50 w-[var(--radix-popover-trigger-width)] overflow-hidden rounded-[12px] border p-0 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
        >
          <Command label="Buscar categoría" className="flex flex-col">
            <div className="border-border-default flex items-center gap-2 border-b px-3">
              <Search
                strokeWidth={1.5}
                className="text-text-tertiary size-[14px] shrink-0"
              />
              <Command.Input
                placeholder="Buscar categoría…"
                autoFocus
                className="text-text placeholder:text-text-tertiary flex-1 bg-transparent py-2.5 text-sm outline-none"
              />
            </div>

            <Command.List className="max-h-[360px] overflow-y-auto py-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-[var(--border-emphasis)] [&::-webkit-scrollbar-track]:bg-transparent">
              <Command.Empty className="text-text-tertiary px-3 py-4 text-center text-[13px]">
                Sin resultados.
              </Command.Empty>

              <Command.Item
                value={`__none__ ${emptyLabel}`}
                onSelect={() => {
                  onChange('')
                  setOpen(false)
                }}
                className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-1 flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-sm outline-none transition-colors"
              >
                <span className="flex-1 italic">{emptyLabel}</span>
                {value === '' && (
                  <Check
                    strokeWidth={2}
                    className="size-[14px]"
                    style={{ color: 'var(--purple-base)' }}
                  />
                )}
              </Command.Item>

              {options.map((opt) => {
                const isSelected = opt.id === value
                return (
                  <Command.Item
                    key={opt.id}
                    value={opt.name}
                    onSelect={() => {
                      onChange(opt.id)
                      setOpen(false)
                    }}
                    className="text-text-secondary aria-selected:bg-surface-hover aria-selected:text-text mx-1 flex h-8 cursor-pointer items-center gap-2 rounded-[6px] px-2 text-sm outline-none transition-colors"
                  >
                    <span className="flex-1 truncate">{opt.name}</span>
                    {isSelected && (
                      <Check
                        strokeWidth={2}
                        className="size-[14px]"
                        style={{ color: 'var(--purple-base)' }}
                      />
                    )}
                  </Command.Item>
                )
              })}
            </Command.List>
          </Command>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
