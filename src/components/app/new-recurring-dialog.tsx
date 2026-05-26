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
import { createRecurringRule } from '@/app/(app)/ajustes/recurring/actions'
import { useDialogStore } from './dialog-store'

type AccountOption = { id: string; name: string; currency: string }
type CategoryOption = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
}

const schema = z.object({
  description: z.string().trim().min(1, 'Requerido'),
  accountId: z.string().min(1),
  categoryId: z.string().optional().or(z.literal('')),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido'),
  kind: z.enum(['income', 'expense']),
  frequency: z.enum(['monthly', 'weekly', 'biweekly', 'quarterly', 'yearly', 'daily']),
  nextRun: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  autoCreate: z.boolean(),
})

type FormValues = z.infer<typeof schema>

const SENTINEL = '__none__'

export function NewRecurringDialog({
  accounts,
  categories,
}: {
  accounts: AccountOption[]
  categories: CategoryOption[]
}) {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-recurring'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <NewRecurringForm
          accounts={accounts}
          categories={categories}
          onDone={close}
        />
      )}
    </Dialog>
  )
}

function NewRecurringForm({
  accounts,
  categories,
  onDone,
}: {
  accounts: AccountOption[]
  categories: CategoryOption[]
  onDone: () => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const defaultAccountId = accounts[0]?.id ?? ''
  const today = new Date().toISOString().slice(0, 10)
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      description: '',
      accountId: defaultAccountId,
      categoryId: SENTINEL,
      amount: '',
      kind: 'expense',
      frequency: 'monthly',
      nextRun: today,
      autoCreate: true,
    },
  })

  const kind = watch('kind')
  const accountId = watch('accountId')
  const account = accounts.find((a) => a.id === accountId)
  const eligibleCategories = categories.filter((c) => c.kind === kind)

  function onSubmit(values: FormValues) {
    setServerError(null)
    if (!account) {
      setServerError('Cuenta inválida.')
      return
    }
    startTransition(async () => {
      const res = await createRecurringRule({
        description: values.description,
        accountId: values.accountId,
        categoryId:
          values.categoryId && values.categoryId !== SENTINEL ? values.categoryId : null,
        amount: values.amount,
        currency: account.currency as 'COP',
        kind: values.kind,
        frequency: values.frequency,
        nextRun: values.nextRun,
        autoCreate: values.autoCreate,
      })
      if (!res.ok) {
        setServerError(res.error.message)
        return
      }
      toast.success('Regla creada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nueva regla recurrente</DialogTitle>
        <DialogDescription>
          Finanzia crea la transacción automáticamente cada vez que vence
          (siempre que dejes auto-crear activo). Catch-up incluido si el
          cron se cae.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Descripción" htmlFor="rec-desc" error={errors.description?.message}>
          <Input id="rec-desc" placeholder="Arriendo, Netflix, salario" {...register('description')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo">
            <div className="border-border-default flex rounded-[8px] border p-0.5">
              {(['expense', 'income'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setValue('kind', k, { shouldValidate: true })}
                  className={`flex-1 rounded-[6px] py-1.5 text-sm transition-colors ${
                    kind === k
                      ? 'bg-surface-hover text-text'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  {k === 'expense' ? 'Gasto' : 'Ingreso'}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Frecuencia">
            <Select
              value={watch('frequency')}
              onValueChange={(v) =>
                setValue('frequency', v as FormValues['frequency'], { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="biweekly">Quincenal</SelectItem>
                <SelectItem value="quarterly">Trimestral</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
                <SelectItem value="daily">Diaria</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Cuenta">
            <Select
              value={watch('accountId')}
              onValueChange={(v) => setValue('accountId', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name} · {a.currency}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field
            label="Categoría"
            hint={eligibleCategories.length === 0 ? 'Sin categorías para este tipo' : undefined}
          >
            <Select
              value={watch('categoryId') || SENTINEL}
              onValueChange={(v) => setValue('categoryId', v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Sin categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={SENTINEL}>Sin categoría</SelectItem>
                {eligibleCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto" htmlFor="rec-amount" error={errors.amount?.message}>
            <Input
              id="rec-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="tabular"
              {...register('amount')}
            />
          </Field>
          <Field
            label="Próxima ejecución"
            htmlFor="rec-next"
            error={errors.nextRun?.message}
          >
            <Input
              id="rec-next"
              type="date"
              className="tabular"
              {...register('nextRun')}
            />
          </Field>
        </div>

        <label className="text-text-secondary flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={watch('autoCreate')}
            onChange={(e) => setValue('autoCreate', e.target.checked)}
            className="size-4 accent-[color:var(--accent-ai)]"
          />
          Auto-crear la transacción (si lo desactivas, llega una alert para
          que la registres manualmente)
        </label>

        {serverError && <p className="text-negative text-xs">{serverError}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Crear regla'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
