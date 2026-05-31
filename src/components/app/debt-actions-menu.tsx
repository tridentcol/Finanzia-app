'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownMenu } from 'radix-ui'
import { toast } from 'sonner'

import { archiveDebt, markDebtPaid } from '@/app/(app)/mi-dinero/deudas/actions'
import { icons } from '@/lib/design/icons'
import type { Debt } from '@/lib/db/schema'
import { EditDebtDialog } from './edit-debt-dialog'

export function DebtActionsMenu({ debt }: { debt: Debt }) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const More = icons['more-horizontal']
  const Pencil = icons.pencil
  const Check = icons.check
  const Trash = icons.trash

  function onMarkPaid() {
    if (
      !window.confirm(
        `¿Marcar "${debt.name}" como pagada? El saldo pendiente quedará en 0 y la deuda pasará al histórico.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await markDebtPaid(debt.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`${debt.name} marcada como pagada.`)
      router.refresh()
    })
  }

  function onDelete() {
    if (
      !window.confirm(
        `¿Eliminar "${debt.name}"? Quedará archivada y fuera de los listados. No se puede deshacer desde la app.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await archiveDebt(debt.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`${debt.name} eliminada.`)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Acciones de ${debt.name}`}
          disabled={pending}
          className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text data-[state=open]:bg-surface-hover data-[state=open]:text-text flex size-8 shrink-0 items-center justify-center rounded-[8px] border outline-none transition-colors disabled:opacity-50"
        >
          <More strokeWidth={1.5} className="size-[14px]" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="border-border-default bg-surface-elevated z-50 min-w-[220px] overflow-hidden rounded-[12px] border p-1 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <DropdownMenu.Item
              onSelect={() => setEditOpen(true)}
              className="text-text-secondary data-[highlighted]:bg-surface-hover data-[highlighted]:text-text flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors"
            >
              <Pencil strokeWidth={1.5} className="h-4 w-4" />
              Editar datos
            </DropdownMenu.Item>
            <DropdownMenu.Item
              onSelect={onMarkPaid}
              disabled={pending}
              className="text-text-secondary data-[highlighted]:bg-surface-hover data-[highlighted]:text-text flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors disabled:opacity-50"
            >
              <Check strokeWidth={1.5} className="h-4 w-4" />
              Marcar pagada
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="bg-border-default my-1 h-px" />
            <DropdownMenu.Item
              onSelect={onDelete}
              disabled={pending}
              className="text-negative data-[highlighted]:bg-surface-hover flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors disabled:opacity-50"
            >
              <Trash strokeWidth={1.5} className="h-4 w-4" />
              Eliminar deuda
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <EditDebtDialog open={editOpen} onOpenChange={setEditOpen} debt={debt} />
    </>
  )
}
