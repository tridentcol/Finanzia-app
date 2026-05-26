'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { updateCategory } from '@/app/(app)/categorias/actions'
import { useDialogStore } from './dialog-store'
import { icons, type IconName } from '@/lib/design/icons'
import {
  categoryPaletteEntries,
  type CategoryPaletteKey,
} from '@/lib/design/palette'
import { cn } from '@/lib/utils'

type CategoryOption = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  parentId: string | null
  icon: string | null
  color: string | null
}

type Props = {
  categories: CategoryOption[]
}

const NO_PARENT = '__none__'

const iconChoices: IconName[] = [
  'tag',
  'shopping-bag',
  'utensils',
  'car',
  'home',
  'heart-pulse',
  'book-open',
  'sparkles',
  'plane',
  'gift',
  'dumbbell',
  'phone',
  'plug',
  'coffee',
  'piggy-bank',
  'briefcase',
]

const schema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(60, 'Máx 60'),
  parentId: z.string().optional(),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex inválido'),
})

type FormValues = z.infer<typeof schema>

export function EditCategoryDialog({ categories }: Props) {
  const active = useDialogStore((s) => s.active)
  const payload = useDialogStore((s) => s.payload)
  const close = useDialogStore((s) => s.close)
  const open = active === 'edit-category'

  const target = useMemo(
    () => (open && payload?.id ? categories.find((c) => c.id === payload.id) : null),
    [open, payload, categories],
  )

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && target ? (
        <EditCategoryForm category={target} categories={categories} onDone={close} />
      ) : open ? (
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Categoría no encontrada</DialogTitle>
            <DialogDescription>
              La categoría puede haber sido archivada o eliminada.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={close}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      ) : null}
    </Dialog>
  )
}

function EditCategoryForm({
  category,
  categories,
  onDone,
}: {
  category: CategoryOption
  categories: CategoryOption[]
  onDone: () => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: category.name,
      parentId: category.parentId ?? NO_PARENT,
      icon: (category.icon ?? 'tag') as string,
      color: category.color ?? '#6B7280',
    },
  })

  const selectedIcon = watch('icon') as IconName
  const selectedColor = watch('color')

  const parentOptions = useMemo(
    () =>
      categories.filter(
        (c) => c.kind === category.kind && c.parentId === null && c.id !== category.id,
      ),
    [categories, category],
  )

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await updateCategory({
        id: category.id,
        name: values.name,
        icon: values.icon,
        color: values.color,
        parentId:
          values.parentId && values.parentId !== NO_PARENT ? values.parentId : null,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }
      toast.success('Categoría actualizada.')
      router.refresh()
      onDone()
    })
  }

  const Preview = icons[selectedIcon] ?? icons.tag

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Editar categoría</DialogTitle>
        <DialogDescription>
          El tipo no se puede cambiar — crearía inconsistencias con
          transacciones ya registradas.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div
            className="border-border-default flex h-12 w-12 items-center justify-center rounded-[10px] border"
            style={{ color: selectedColor }}
          >
            <Preview strokeWidth={1.5} className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <Field label="Nombre" htmlFor="edit-cat-name" error={errors.name?.message}>
              <Input id="edit-cat-name" autoFocus {...register('name')} />
            </Field>
          </div>
        </div>

        <Field
          label="Categoría padre"
          hint={parentOptions.length === 0 ? 'Sin padres disponibles' : 'Opcional'}
        >
          <Select
            value={watch('parentId') ?? NO_PARENT}
            onValueChange={(v) => setValue('parentId', v)}
            disabled={parentOptions.length === 0}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin padre" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NO_PARENT}>Sin padre</SelectItem>
              {parentOptions.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Icono">
          <div className="grid grid-cols-8 gap-2">
            {iconChoices.map((name) => {
              const Icon = icons[name]
              const selected = name === selectedIcon
              return (
                <button
                  key={name}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setValue('icon', name)}
                  className={cn(
                    'border-border-default flex h-9 w-9 items-center justify-center rounded-[6px] border transition-colors',
                    selected
                      ? 'bg-surface-hover text-text border-border-emphasis'
                      : 'text-text-tertiary hover:text-text hover:bg-surface-hover/60',
                  )}
                >
                  <Icon strokeWidth={1.5} className="h-4 w-4" />
                </button>
              )
            })}
          </div>
        </Field>

        <Field label="Color">
          <div className="flex flex-wrap gap-2">
            {categoryPaletteEntries.map(([key, hex]) => {
              const selected = hex === selectedColor
              return (
                <button
                  key={key}
                  type="button"
                  aria-label={key as CategoryPaletteKey}
                  aria-pressed={selected}
                  onClick={() => setValue('color', hex)}
                  className={cn(
                    'h-7 w-7 rounded-full border-2 transition-transform',
                    selected
                      ? 'border-text'
                      : 'border-transparent hover:border-border-emphasis',
                  )}
                  style={{ backgroundColor: hex }}
                />
              )
            })}
          </div>
        </Field>

        {serverError && <p className="text-negative text-xs">{serverError}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
