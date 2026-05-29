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
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { currencyCodes, currencies } from '@/lib/currency/currencies'
import { createDebt } from '@/app/(app)/mi-dinero/deudas/actions'
import { useDialogStore } from './dialog-store'

const debtTypes = [
  { value: 'loan_personal', label: 'Préstamo personal' },
  { value: 'mortgage', label: 'Hipoteca' },
  { value: 'auto_loan', label: 'Crédito de vehículo' },
  { value: 'student_loan', label: 'Crédito educativo' },
  { value: 'family_loan', label: 'Préstamo familiar' },
  { value: 'other', label: 'Otra' },
] as const

const schema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80'),
  lender: z.string().trim().max(80).optional(),
  type: z.enum(debtTypes.map((t) => t.value) as [string, ...string[]]),
  currency: z.enum(currencyCodes as [string, ...string[]]),
  principal: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Formato 1234.56'),
  currentBalance: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Formato 1234.56'),
  interestRate: z.string().optional(),
  installmentAmount: z.string().optional(),
  termMonths: z.string().optional(),
  originDate: z.string().optional(),
  nextPaymentDate: z.string().optional(),
  paymentDay: z.string().optional(),
  notes: z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

export function NewDebtDialog() {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-debt'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && <NewDebtForm onDone={close} />}
    </Dialog>
  )
}

function NewDebtForm({ onDone }: { onDone: () => void }) {
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
      type: 'loan_personal',
      currency: 'COP',
      principal: '',
      currentBalance: '',
    },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createDebt({
        name: values.name,
        lender: values.lender?.trim() || null,
        type: values.type as 'loan_personal',
        currency: values.currency,
        principal: values.principal,
        currentBalance: values.currentBalance,
        interestRate: values.interestRate?.trim() || null,
        installmentAmount: values.installmentAmount?.trim() || null,
        termMonths: values.termMonths
          ? Number.parseInt(values.termMonths, 10)
          : null,
        originDate: values.originDate || null,
        nextPaymentDate: values.nextPaymentDate || null,
        paymentDay: values.paymentDay
          ? Number.parseInt(values.paymentDay, 10)
          : null,
        notes: values.notes?.trim() || null,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }

      toast.success('Deuda registrada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nueva deuda</DialogTitle>
        <DialogDescription>
          Registra un préstamo, hipoteca o cualquier obligación de pago.
          Las tarjetas de crédito viven en Mi dinero · Tarjetas.
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
      >
        <Field label="Nombre" htmlFor="debt-name" error={errors.name?.message}>
          <Input
            id="debt-name"
            placeholder="Hipoteca apartamento"
            autoFocus
            {...register('name')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Tipo" error={errors.type?.message}>
            <Select
              value={watch('type')}
              onValueChange={(v) =>
                setValue('type', v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                {debtTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Moneda" error={errors.currency?.message}>
            <Select
              value={watch('currency')}
              onValueChange={(v) =>
                setValue('currency', v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Moneda" />
              </SelectTrigger>
              <SelectContent>
                {currencyCodes.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code} — {currencies[code].name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field
          label="Prestamista"
          htmlFor="debt-lender"
          error={errors.lender?.message}
          hint="Banco, persona o entidad — opcional"
        >
          <Input
            id="debt-lender"
            placeholder="Bancolombia"
            {...register('lender')}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Monto original"
            htmlFor="debt-principal"
            error={errors.principal?.message}
            hint="Lo asumido al inicio"
          >
            <Input
              id="debt-principal"
              inputMode="decimal"
              placeholder="50000000"
              className="tabular"
              {...register('principal')}
            />
          </Field>
          <Field
            label="Saldo actual"
            htmlFor="debt-balance"
            error={errors.currentBalance?.message}
            hint="Lo que aún debes"
          >
            <Input
              id="debt-balance"
              inputMode="decimal"
              placeholder="42000000"
              className="tabular"
              {...register('currentBalance')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Interés anual (%)"
            htmlFor="debt-interest"
            error={errors.interestRate?.message}
            hint="Nominal. Opcional."
          >
            <Input
              id="debt-interest"
              inputMode="decimal"
              placeholder="18.50"
              className="tabular"
              {...register('interestRate')}
            />
          </Field>
          <Field
            label="Cuota mensual"
            htmlFor="debt-installment"
            error={errors.installmentAmount?.message}
            hint="Opcional"
          >
            <Input
              id="debt-installment"
              inputMode="decimal"
              placeholder="850000"
              className="tabular"
              {...register('installmentAmount')}
            />
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field
            label="Plazo (meses)"
            htmlFor="debt-term"
            error={errors.termMonths?.message}
          >
            <Input
              id="debt-term"
              type="number"
              min={1}
              max={720}
              placeholder="60"
              className="tabular"
              {...register('termMonths')}
            />
          </Field>
          <Field
            label="Día de pago"
            htmlFor="debt-pay-day"
            error={errors.paymentDay?.message}
          >
            <Input
              id="debt-pay-day"
              type="number"
              min={1}
              max={31}
              placeholder="5"
              className="tabular"
              {...register('paymentDay')}
            />
          </Field>
          <Field
            label="Origen"
            htmlFor="debt-origin"
            error={errors.originDate?.message}
            hint="Opcional"
          >
            <Input
              id="debt-origin"
              type="date"
              {...register('originDate')}
            />
          </Field>
        </div>

        <Field
          label="Próximo pago"
          htmlFor="debt-next-pay"
          error={errors.nextPaymentDate?.message}
          hint="Fecha exacta del próximo vencimiento"
        >
          <Input
            id="debt-next-pay"
            type="date"
            {...register('nextPaymentDate')}
          />
        </Field>

        <Field
          label="Notas"
          htmlFor="debt-notes"
          error={errors.notes?.message}
          hint="Opcional"
        >
          <Textarea
            id="debt-notes"
            rows={2}
            placeholder="Cualquier contexto que quieras recordar"
            {...register('notes')}
          />
        </Field>

        {serverError && (
          <p className="text-negative text-xs">{serverError}</p>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={onDone}
            disabled={pending}
          >
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Registrando…' : 'Registrar deuda'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
