'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownMenu } from 'radix-ui'
import { toast } from 'sonner'

import { archiveCard } from '@/app/(app)/mi-dinero/tarjetas/actions'
import { icons } from '@/lib/design/icons'
import { EditCardDialog } from './edit-card-dialog'

type Props = {
  card: {
    id: string
    name: string
    creditLimit: string | null
    statementDay: number | null
    paymentDay: number | null
    bankSlug: string | null
    cardProductSlug: string | null
    cardBrand: string | null
    cardLastFour: string | null
    cardHolderName: string | null
  }
}

export function CardActionsMenu({ card }: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const More = icons['more-horizontal']
  const Pencil = icons.pencil
  const Trash = icons.trash

  function onCancel() {
    if (
      !window.confirm(
        `¿Cancelar "${card.name}"? La tarjeta quedará archivada y no aparecerá en listados activos. Sus movimientos históricos se conservan.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await archiveCard(card.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`${card.name} cancelada.`)
      router.push('/mi-dinero/tarjetas')
    })
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Acciones de ${card.name}`}
          disabled={pending}
          className="border-border-default bg-surface hover:bg-surface-hover text-text-secondary hover:text-text data-[state=open]:bg-surface-hover data-[state=open]:text-text flex h-9 items-center gap-2 rounded-[8px] border px-3 text-sm transition-colors outline-none disabled:opacity-50"
        >
          <More strokeWidth={1.5} className="size-[14px]" />
          <span>Gestionar</span>
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
            <DropdownMenu.Separator className="bg-border-default my-1 h-px" />
            <DropdownMenu.Item
              onSelect={onCancel}
              disabled={pending}
              className="text-negative data-[highlighted]:bg-surface-hover flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors disabled:opacity-50"
            >
              <Trash strokeWidth={1.5} className="h-4 w-4" />
              Cancelar tarjeta
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <EditCardDialog open={editOpen} onOpenChange={setEditOpen} card={card} />
    </>
  )
}
