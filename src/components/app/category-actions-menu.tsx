'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DropdownMenu } from 'radix-ui'
import { toast } from 'sonner'

import { useDialogStore } from './dialog-store'
import { archiveCategory, deleteCategory } from '@/app/(app)/categorias/actions'
import { icons } from '@/lib/design/icons'

export function CategoryActionsMenu({
  categoryId,
  categoryName,
}: {
  categoryId: string
  categoryName: string
}) {
  const router = useRouter()
  const openDialog = useDialogStore((s) => s.open)
  const [pending, startTransition] = useTransition()
  const More = icons['more-horizontal']
  const Pencil = icons.pencil
  const Trash = icons.trash
  const Archive = icons['rotate-ccw'] // reusamos rotate-ccw como "archivar"

  function onEdit() {
    openDialog('edit-category', { id: categoryId })
  }

  function onArchive() {
    startTransition(async () => {
      const result = await archiveCategory(categoryId)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`${categoryName} archivada.`)
      router.refresh()
    })
  }

  function onDelete() {
    if (
      !window.confirm(
        `¿Eliminar "${categoryName}" definitivamente? Esta acción no se puede deshacer.`,
      )
    ) {
      return
    }
    startTransition(async () => {
      const result = await deleteCategory(categoryId)
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      toast.success(`${categoryName} eliminada.`)
      router.refresh()
    })
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger
        aria-label={`Acciones de ${categoryName}`}
        disabled={pending}
        className="text-text-tertiary hover:text-text hover:bg-surface-hover rounded-md p-1 transition-colors disabled:opacity-50 outline-none data-[state=open]:bg-surface-hover data-[state=open]:text-text"
      >
        <More strokeWidth={1.5} className="h-4 w-4" />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="border-border-default bg-surface-elevated z-50 min-w-[180px] overflow-hidden rounded-[12px] border p-1 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <DropdownMenu.Item
            onSelect={onEdit}
            className="text-text-secondary data-[highlighted]:bg-surface-hover data-[highlighted]:text-text flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors"
          >
            <Pencil strokeWidth={1.5} className="h-4 w-4" />
            Editar
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={onArchive}
            className="text-text-secondary data-[highlighted]:bg-surface-hover data-[highlighted]:text-text flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors"
          >
            <Archive strokeWidth={1.5} className="h-4 w-4" />
            Archivar
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="bg-border-default my-1 h-px" />
          <DropdownMenu.Item
            onSelect={onDelete}
            className="text-negative data-[highlighted]:bg-surface-hover flex h-9 cursor-pointer items-center gap-3 rounded-[6px] px-2 text-sm outline-none transition-colors"
          >
            <Trash strokeWidth={1.5} className="h-4 w-4" />
            Eliminar
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
