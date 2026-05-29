'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownMenu } from 'radix-ui'
import { toast } from 'sonner'

import { deleteTransaction } from '@/app/(app)/mi-dinero/movimientos/actions'
import { icons } from '@/lib/design/icons'
import { ConfirmDialog } from './confirm-dialog'
import { EditTransactionDialog } from './edit-transaction-dialog'

type AccountOption = {
  id: string
  name: string
  currency: string
  type: string
}

type CategoryOption = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  parentId: string | null
}

type Tx = {
  id: string
  kind: 'income' | 'expense' | 'transfer'
  accountId: string
  categoryId: string | null
  date: string
  amountOriginal: string
  currency: string
  description: string
  notes: string | null
}

type Props = {
  transaction: Tx
  accounts: AccountOption[]
  categories: CategoryOption[]
}

export function TransactionActionsMenu({
  transaction,
  accounts,
  categories,
}: Props) {
  const router = useRouter()
  const [editOpen, setEditOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pending, startTransition] = useTransition()
  const More = icons['more-horizontal']
  const Pencil = icons.pencil
  const Trash = icons.trash

  function onDelete() {
    startTransition(async () => {
      const result = await deleteTransaction(transaction.id)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success('Movimiento eliminado.')
      setConfirmOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          aria-label={`Acciones para ${transaction.description}`}
          disabled={pending}
          className="text-text-tertiary hover:text-text hover:bg-surface-hover -m-1 rounded-md p-1 transition-colors outline-none data-[state=open]:bg-surface-hover data-[state=open]:text-text disabled:opacity-50"
          onClick={(e) => e.stopPropagation()}
        >
          <More strokeWidth={1.5} className="size-4" />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            sideOffset={6}
            className="border-border-default bg-surface-elevated z-50 min-w-[180px] overflow-hidden rounded-[12px] border p-1 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          >
            <DropdownMenu.Item
              onSelect={() => setEditOpen(true)}
              className="text-text-secondary data-[highlighted]:bg-surface-hover data-[highlighted]:text-text flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors"
            >
              <Pencil strokeWidth={1.5} className="h-4 w-4" />
              Editar
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="bg-border-default my-1 h-px" />
            <DropdownMenu.Item
              onSelect={() => setConfirmOpen(true)}
              className="text-negative data-[highlighted]:bg-surface-hover flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors"
            >
              <Trash strokeWidth={1.5} className="h-4 w-4" />
              Eliminar
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <EditTransactionDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        transaction={transaction}
        accounts={accounts}
        categories={categories}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="¿Eliminar este movimiento?"
        description={
          <>
            <span className="text-text">{transaction.description}</span>
            <br />
            Esta acción se puede deshacer manualmente — el movimiento queda
            archivado, no se borra físicamente.
          </>
        }
        confirmLabel="Eliminar"
        tone="danger"
        onConfirm={onDelete}
      />
    </>
  )
}
