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
import { createBudget } from '@/app/(app)/presupuestos/actions'
import { useDialogStore } from './dialog-store'

type CategoryOption = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  parentId: string | null
}

type Props = {
  categories: CategoryOption[]
}

const periodOptions = [
  { value: 'monthly' as const, label: 'Mensual' },
  { value: 'weekly' as const, label: 'Semanal' },
  { value: 'yearly' as const, label: 'Anual' },
]

const schema = z.object({
  categoryId: z.string().min(1, 'Selecciona una categoría'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto positivo, ej 500000'),
  period: z.enum(['monthly', 'weekly', 'yearly']),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  rollover: z.boolean().optional(),
})

type FormValues = z.infer<typeof schema>

function firstDayOfMonth(): string {
  const now = new Date()
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}-01`
}

export function NewBudgetDialog({ categories }: Props) {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-budget'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && <NewBudgetForm categories={categories} onDone={close} />}
    </Dialog>
  )
}

function NewBudgetForm({
  categories,
  onDone,
}: Props & { onDone: () => void }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const expenseCategories = useMemo(
    () => categories.filter((c) => c.kind === 'expense'),
    [categories],
  )

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      categoryId: '',
      amount: '',
      period: 'monthly',
      startDate: firstDayOfMonth(),
      rollover: false,
    },
  })

  if (expenseCategories.length === 0) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo presupuesto</DialogTitle>
          <DialogDescription>
            Necesitas al menos una categoría de gasto disponible para crear un
            presupuesto.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onDone}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createBudget({
        categoryId: values.categoryId,
        amount: values.amount,
        period: values.period,
        startDate: values.startDate,
        rollover: values.rollover ?? false,
      })
      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }
      toast.success('Presupuesto creado.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nuevo presupuesto</DialogTitle>
        <DialogDescription>
          Define un tope para una categoría de gasto. Finanzia compara el gasto
          del período actual contra el límite, sin sermones.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field
          label="Categoría"
          error={errors.categoryId?.message}
          hint="Solo categorías de gasto pueden presupuestarse"
        >
          <Select
            value={watch('categoryId')}
            onValueChange={(v) =>
              setValue('categoryId', v, { shouldValidate: true })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Elige una categoría" />
            </SelectTrigger>
            <SelectContent>
              {expenseCategories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.parentId ? '· ' : ''}
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field
            label="Monto del tope"
            htmlFor="bud-amount"
            error={errors.amount?.message}
            hint="Sin símbolos"
          >
            <Input
              id="bud-amount"
              inputMode="decimal"
              placeholder="500000"
              className="tabular"
              {...register('amount')}
            />
          </Field>
          <Field label="Período">
            <Select
              value={watch('period')}
              onValueChange={(v) =>
                setValue('period', v as FormValues['period'], { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {periodOptions.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Inicio del presupuesto"
          htmlFor="bud-start"
          error={errors.startDate?.message}
          hint="Solo se usa como referencia; el cálculo del período es automático"
        >
          <Input
            id="bud-start"
            type="date"
            className="tabular"
            {...register('startDate')}
          />
        </Field>

        <label className="flex items-start gap-3 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="accent-text mt-1 size-4 cursor-pointer"
            {...register('rollover')}
          />
          <span className="flex flex-col gap-0.5">
            <span className="text-text">Trasladar saldo no usado al siguiente período</span>
            <span className="text-text-tertiary text-[12px]">
              Si no gastas todo el tope, el remanente se suma al próximo período.
            </span>
          </span>
        </label>

        {serverError && <p className="text-negative text-xs">{serverError}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Creando…' : 'Crear presupuesto'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
