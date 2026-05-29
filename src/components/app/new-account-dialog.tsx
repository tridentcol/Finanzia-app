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
import { currencyCodes, currencies } from '@/lib/currency/currencies'
import { createAccount } from '@/app/(app)/mi-dinero/cuentas/actions'
import { useDialogStore } from './dialog-store'

// Las tarjetas de crédito viven en /mi-dinero/tarjetas con su propio dialog
// (NewCardDialog). Aquí se registran cuentas líquidas y activos — sin
// mecánica de cupo/corte/pago y sin identidad visual de tarjeta (la cuenta
// es la cuenta, la tarjeta es algo distinto).
const accountTypes = [
  { value: 'checking', label: 'Cuenta corriente' },
  { value: 'savings', label: 'Ahorros' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'investment', label: 'Inversión' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'other', label: 'Otra' },
] as const

const schema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80'),
  type: z.enum(accountTypes.map((t) => t.value) as [string, ...string[]]),
  currency: z.enum(currencyCodes as [string, ...string[]]),
  initialBalance: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, 'Formato 1234.56'),
})

type FormValues = z.infer<typeof schema>

export function NewAccountDialog() {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-account'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && <NewAccountForm onDone={close} />}
    </Dialog>
  )
}

function NewAccountForm({ onDone }: { onDone: () => void }) {
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
      type: 'checking',
      currency: 'COP',
      initialBalance: '0',
    },
  })

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await createAccount({
        name: values.name,
        type: values.type as 'checking',
        currency: values.currency,
        initialBalance: values.initialBalance,
        creditLimit: null,
        statementDay: null,
        paymentDay: null,
        bankSlug: null,
        cardProductSlug: null,
        cardBrand: null,
        cardLastFour: null,
        cardHolderName: null,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }

      toast.success('Cuenta creada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>Nueva cuenta</DialogTitle>
        <DialogDescription>
          Cuenta corriente, ahorros, efectivo, inversión. Las tarjetas de
          crédito se registran desde Mi dinero · Tarjetas.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field
          label="Nombre"
          htmlFor="account-name"
          error={errors.name?.message}
        >
          <Input
            id="account-name"
            placeholder="Bancolombia ahorros"
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
                {accountTypes.map((t) => (
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
          label="Saldo inicial"
          htmlFor="initial-balance"
          error={errors.initialBalance?.message}
          hint="Sin símbolos, ej. 1500000 o 1500000.50"
        >
          <Input
            id="initial-balance"
            inputMode="decimal"
            placeholder="0"
            className="tabular"
            {...register('initialBalance')}
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
            {pending ? 'Creando…' : 'Crear cuenta'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
