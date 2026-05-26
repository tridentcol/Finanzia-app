'use client'

import { useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setTransactionCategory } from '@/app/(app)/transacciones/actions'
import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

export type CategoryOption = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  parentId: string | null
}

type Props = {
  transactionId: string
  txKind: 'income' | 'expense' | 'transfer'
  currentCategoryId: string | null
  currentCategoryName: string | null
  aiCategorized: boolean
  aiConfidence: string | null
  options: CategoryOption[]
}

const SENTINEL_UNSET = '__unset__'

/**
 * Cell editable. Click → Select con categorías del mismo kind.
 * Muestra sparkle `accent-ai` si la categoría fue propuesta por la IA.
 * Cuando el usuario elige otra, marca user_corrected = true en el server.
 */
export function CategoryCell({
  transactionId,
  txKind,
  currentCategoryId,
  currentCategoryName,
  aiCategorized,
  aiConfidence,
  options,
}: Props) {
  const [pending, startTransition] = useTransition()
  const [open, setOpen] = useState(false)

  const filtered = useMemo(
    () => options.filter((c) => c.kind === txKind),
    [options, txKind],
  )

  const grouped = useMemo(() => {
    const roots = filtered.filter((c) => c.parentId === null)
    const childrenByParent = new Map<string, typeof filtered>()
    for (const c of filtered) {
      if (!c.parentId) continue
      const list = childrenByParent.get(c.parentId) ?? []
      list.push(c)
      childrenByParent.set(c.parentId, list)
    }
    return roots.map((root) => ({
      root,
      children: childrenByParent.get(root.id) ?? [],
    }))
  }, [filtered])

  function onChange(value: string) {
    const nextId = value === SENTINEL_UNSET ? null : value
    if (nextId === currentCategoryId) return
    startTransition(async () => {
      const res = await setTransactionCategory({
        transactionId,
        categoryId: nextId,
      })
      if (!res.ok) {
        toast.error(res.error.message)
        return
      }
      toast.success('Categoría actualizada.')
    })
  }

  const Spark = icons.sparkles
  const confidencePct =
    aiConfidence && !Number.isNaN(Number(aiConfidence))
      ? Math.round(Number(aiConfidence) * 100)
      : null

  if (txKind === 'transfer') {
    return <span className="text-text-tertiary text-sm">—</span>
  }

  return (
    <Select
      value={currentCategoryId ?? SENTINEL_UNSET}
      onValueChange={onChange}
      open={open}
      onOpenChange={setOpen}
    >
      <SelectTrigger
        aria-label="Cambiar categoría"
        className={cn(
          'h-7 w-auto min-w-[140px] gap-1.5 border-transparent bg-transparent px-2 py-1 text-sm',
          'hover:border-border-default hover:bg-surface-hover',
          pending && 'opacity-60',
        )}
      >
        <div className="flex items-center gap-1.5">
          <span className={currentCategoryName ? 'text-text-secondary' : 'text-text-tertiary'}>
            {currentCategoryName ?? 'Sin categoría'}
          </span>
          {aiCategorized && (
            <span
              title={
                confidencePct !== null
                  ? `Sugerida por IA · ${confidencePct}% confianza`
                  : 'Sugerida por IA'
              }
              className="inline-flex"
            >
              <Spark
                strokeWidth={1.5}
                className="size-3"
                style={{ color: 'var(--accent-ai)' }}
              />
            </span>
          )}
        </div>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SENTINEL_UNSET}>Sin categoría</SelectItem>
        {grouped.length > 0 && <SelectSeparator />}
        {grouped.map(({ root, children }, idx) => {
          if (children.length === 0) {
            return (
              <SelectItem key={root.id} value={root.id}>
                {root.name}
              </SelectItem>
            )
          }
          return (
            <SelectGroup key={root.id}>
              {idx > 0 && <SelectSeparator />}
              <SelectLabel>{root.name}</SelectLabel>
              <SelectItem value={root.id}>Sin subcategoría</SelectItem>
              {children.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectGroup>
          )
        })}
      </SelectContent>
    </Select>
  )
}
