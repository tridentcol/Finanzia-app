'use client'

import type { UseFormReturn } from 'react-hook-form'
import { z } from 'zod'

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
import { currencyCodes, currencies } from '@/lib/currency/currencies'

export const debtTypes = [
  { value: 'loan_personal', label: 'Préstamo personal' },
  { value: 'mortgage', label: 'Hipoteca' },
  { value: 'auto_loan', label: 'Crédito de vehículo' },
  { value: 'student_loan', label: 'Crédito educativo' },
  { value: 'family_loan', label: 'Préstamo familiar' },
  { value: 'other', label: 'Otra' },
] as const

/** Schema compartido entre crear y editar una deuda (los campos son idénticos). */
export const debtFormSchema = z.object({
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

export type DebtFormValues = z.infer<typeof debtFormSchema>

/**
 * Campos del formulario de deuda — compartidos por NewDebtDialog y
 * EditDebtDialog. Presentacional: recibe el form de react-hook-form y solo
 * renderiza los campos (sin submit/footer, que cada dialog maneja).
 *
 * `balanceHint` permite contextualizar "Saldo actual" según el flujo (en
 * edición se aclara que actualizarlo registra el avance del pago).
 */
export function DebtFormFields({
  form,
  balanceHint = 'Lo que aún debes',
}: {
  form: UseFormReturn<DebtFormValues>
  balanceHint?: string
}) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = form

  return (
    <>
      <Field label="Nombre" htmlFor="debt-name" error={errors.name?.message}>
        <Input id="debt-name" placeholder="Hipoteca apartamento" autoFocus {...register('name')} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo" error={errors.type?.message}>
          <Select
            value={watch('type')}
            onValueChange={(v) => setValue('type', v, { shouldValidate: true })}
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
            onValueChange={(v) => setValue('currency', v, { shouldValidate: true })}
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
        <Input id="debt-lender" placeholder="Bancolombia" {...register('lender')} />
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
          hint={balanceHint}
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
        <Field label="Plazo (meses)" htmlFor="debt-term" error={errors.termMonths?.message}>
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
        <Field label="Día de pago" htmlFor="debt-pay-day" error={errors.paymentDay?.message}>
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
        <Field label="Origen" htmlFor="debt-origin" error={errors.originDate?.message} hint="Opcional">
          <Input id="debt-origin" type="date" {...register('originDate')} />
        </Field>
      </div>

      <Field
        label="Próximo pago"
        htmlFor="debt-next-pay"
        error={errors.nextPaymentDate?.message}
        hint="Fecha exacta del próximo vencimiento"
      >
        <Input id="debt-next-pay" type="date" {...register('nextPaymentDate')} />
      </Field>

      <Field label="Notas" htmlFor="debt-notes" error={errors.notes?.message} hint="Opcional">
        <Textarea
          id="debt-notes"
          rows={2}
          placeholder="Cualquier contexto que quieras recordar"
          {...register('notes')}
        />
      </Field>
    </>
  )
}
