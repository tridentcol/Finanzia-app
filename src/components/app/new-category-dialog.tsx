'use client'

import { useState, useTransition } from 'react'
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
import { createCategory } from '@/app/(app)/categorias/actions'
import { useDialogStore } from './dialog-store'
import { icons, type IconName } from '@/lib/design/icons'
import {
  categoryPaletteEntries,
  type CategoryPaletteKey,
} from '@/lib/design/palette'
import { cn } from '@/lib/utils'

// Las categorías son planas — un nivel solo. El usuario crea, edita y elimina
// directamente sin jerarquía padre/hijo. Mantenemos la prop `categories` en
// la signature para compat con DialogsBundle, pero ya no la usamos para
// poblar el select de padre (que ya no existe).
type CategoryOption = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  parentId: string | null
}

type Props = {
  categories: CategoryOption[]
}

const kindOptions = [
  { value: 'expense' as const, label: 'Gasto' },
  { value: 'income' as const, label: 'Ingreso' },
  { value: 'transfer' as const, label: 'Transferencia' },
]

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
  kind: z.enum(['income', 'expense', 'transfer']),
  icon: z.string().min(1),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Hex inválido'),
})

type FormValues = z.infer<typeof schema>

export function NewCategoryDialog(_props: Props) {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-category'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && <NewCategoryForm onDone={close} />}
    </Dialog>
  )
}

function NewCategoryForm({ onDone }: { onDone: () => void }) {
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
      name: '',
      kind: 'expense',
      icon: 'tag',
      color: '#6B7280',
    },
  })

  const selectedIcon = watch('icon') as IconName
  const selectedColor = watch('color')

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createCategory({
        name: values.name,
        kind: values.kind,
        parentId: null,
        icon: values.icon,
        color: values.color,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }
      toast.success('Categoría creada.')
      router.refresh()
      onDone()
    })
  }

  const Preview = icons[selectedIcon] ?? icons.tag

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nueva categoría</DialogTitle>
        <DialogDescription>
          Las categorías del sistema cubren lo común. Crea las tuyas cuando
          necesites granularidad propia.
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
            <Field label="Nombre" htmlFor="cat-name" error={errors.name?.message}>
              <Input
                id="cat-name"
                autoFocus
                placeholder="Por ejemplo, Pet sitting"
                {...register('name')}
              />
            </Field>
          </div>
        </div>

        <Field label="Tipo">
          <Select
            value={watch('kind')}
            onValueChange={(v) =>
              setValue('kind', v as FormValues['kind'], { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {kindOptions.map((k) => (
                <SelectItem key={k.value} value={k.value}>
                  {k.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field label="Icono" hint="Elige uno del set curado">
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
            {pending ? 'Creando…' : 'Crear categoría'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
