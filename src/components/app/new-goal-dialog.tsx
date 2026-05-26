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
import { createGoal } from '@/app/(app)/metas/actions'
import { currencyCodes } from '@/lib/currency/currencies'
import { useDialogStore } from './dialog-store'

type AccountOption = { id: string; name: string; currency: string }

const schema = z.object({
  name: z.string().trim().min(1, 'Requerido'),
  targetAmount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido'),
  currency: z.string().min(3).max(3),
  targetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal('')),
  linkedAccountId: z.string().optional().or(z.literal('')),
  initialAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional().or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

const SENTINEL = '__none__'

export function NewGoalDialog({ accounts }: { accounts: AccountOption[] }) {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-goal'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && <NewGoalForm accounts={accounts} onDone={close} />}
    </Dialog>
  )
}

function NewGoalForm({
  accounts,
  onDone,
}: {
  accounts: AccountOption[]
  onDone: () => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: '',
      targetAmount: '',
      currency: accounts[0]?.currency ?? 'COP',
      targetDate: '',
      linkedAccountId: SENTINEL,
      initialAmount: '',
    },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const linkedAccountId =
        values.linkedAccountId && values.linkedAccountId !== SENTINEL
          ? values.linkedAccountId
          : null
      const res = await createGoal({
        name: values.name,
        targetAmount: values.targetAmount,
        currency: values.currency as 'COP',
        targetDate: values.targetDate || null,
        linkedAccountId,
        initialAmount: values.initialAmount || null,
      })
      if (!res.ok) {
        setServerError(res.error.message)
        return
      }
      toast.success('Meta creada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nueva meta</DialogTitle>
        <DialogDescription>
          Define un objetivo en monto + fecha (opcional). Si lo vinculas a una
          cuenta, los depósitos en esa cuenta contarán hacia la meta.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Nombre" htmlFor="goal-name" error={errors.name?.message}>
          <Input id="goal-name" placeholder="Fondo de emergencia" {...register('name')} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Monto objetivo"
            htmlFor="goal-amount"
            error={errors.targetAmount?.message}
          >
            <Input
              id="goal-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="tabular"
              {...register('targetAmount')}
            />
          </Field>
          <Field label="Moneda">
            <Select
              value={watch('currency')}
              onValueChange={(v) => setValue('currency', v, { shouldValidate: true })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currencyCodes.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha objetivo" htmlFor="goal-date" error={errors.targetDate?.message}>
            <Input
              id="goal-date"
              type="date"
              className="tabular"
              {...register('targetDate')}
            />
          </Field>
          <Field
            label="Aporte inicial"
            htmlFor="goal-initial"
            error={errors.initialAmount?.message}
          >
            <Input
              id="goal-initial"
              inputMode="decimal"
              placeholder="0.00"
              className="tabular"
              {...register('initialAmount')}
            />
          </Field>
        </div>

        <Field label="Cuenta vinculada (opcional)">
          <Select
            value={watch('linkedAccountId') || SENTINEL}
            onValueChange={(v) => setValue('linkedAccountId', v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Sin vincular" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={SENTINEL}>Sin vincular</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {serverError && <p className="text-negative text-xs">{serverError}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Crear meta'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
