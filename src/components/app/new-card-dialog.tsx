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
import { currencyCodes, currencies } from '@/lib/currency/currencies'
import { createAccount } from '@/app/(app)/mi-dinero/cuentas/actions'
import { BRAND_LABELS, CARD_CATALOG, type CardBrand } from '@/lib/cards/catalog'
import { CardVisual } from '@/components/cards/card-visual'
import { useDialogStore } from './dialog-store'

const NONE = '__none__'

const schema = z.object({
  // Identidad — los primeros campos del flujo de tarjeta. Banco viene primero
  // porque define producto, red y la imagen del catálogo.
  bankSlug: z.string().min(1, 'Elige el banco'),
  cardProductSlug: z.string().optional(),
  cardBrand: z.string().optional(),
  cardLastFour: z
    .string()
    .regex(/^\d{4}$/, 'Cuatro dígitos')
    .optional()
    .or(z.literal('')),
  cardHolderName: z.string().trim().max(60).optional(),
  // Nombre interno (lo que se muestra en listas y selects de transacción).
  name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80'),
  currency: z.enum(currencyCodes as [string, ...string[]]),
  // Saldo adeudado actual — siempre positivo en el form (lo que debes hoy).
  // Al enviar se convierte a negativo para que en accounts.initial_balance
  // represente "deuda" como signo negativo, consistente con el resto del
  // modelo (un balance < 0 = debes).
  currentDebt: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Formato 1234 o 1234.56'),
  creditLimit: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Cupo requerido')
    .min(1, 'Cupo requerido'),
  statementDay: z
    .string()
    .regex(/^\d{1,2}$/, '1–31')
    .optional()
    .or(z.literal('')),
  paymentDay: z
    .string()
    .regex(/^\d{1,2}$/, '1–31')
    .optional()
    .or(z.literal('')),
})

type FormValues = z.infer<typeof schema>

export function NewCardDialog() {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-card'
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && <NewCardForm onDone={close} />}
    </Dialog>
  )
}

function NewCardForm({ onDone }: { onDone: () => void }) {
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
      bankSlug: '',
      cardLastFour: '',
      cardHolderName: '',
      name: '',
      currency: 'COP',
      currentDebt: '0',
      creditLimit: '',
      statementDay: '',
      paymentDay: '',
    },
  })

  const bankSlug = watch('bankSlug')
  const cardProductSlug = watch('cardProductSlug')
  const cardBrand = watch('cardBrand')
  const cardLastFour = watch('cardLastFour')
  const cardHolderName = watch('cardHolderName')

  const selectedBank = useMemo(
    () => (bankSlug ? CARD_CATALOG.find((b) => b.slug === bankSlug) : null),
    [bankSlug],
  )

  const productsForBank = selectedBank?.creditProducts ?? []
  const selectedProduct = useMemo(
    () => productsForBank.find((p) => p.slug === cardProductSlug) ?? null,
    [productsForBank, cardProductSlug],
  )
  const brandsForProduct = selectedProduct?.brands ?? []

  // Sugerencia de nombre — se aplica automáticamente cuando el usuario no ha
  // escrito uno. Estilo "Bancolombia Mastercard ···· 4821" si hay last4,
  // "Bancolombia Mastercard" si no.
  const currentName = watch('name')
  const suggestedName = useMemo(() => {
    if (!selectedBank) return ''
    const parts: string[] = [selectedBank.name]
    if (selectedProduct) parts.push(selectedProduct.name)
    if (cardLastFour && /^\d{4}$/.test(cardLastFour)) parts.push(`···· ${cardLastFour}`)
    return parts.join(' ')
  }, [selectedBank, selectedProduct, cardLastFour])

  function maybeSuggestName(next: string) {
    if (!currentName || currentName === '' || currentName === suggestedName) {
      setValue('name', next)
    }
  }

  function onSubmit(values: FormValues) {
    setServerError(null)
    // El form expone el saldo adeudado como positivo (UX natural: "debes
    // $350,000"); el modelo de accounts guarda deuda como balance negativo.
    const debt = Number.parseFloat(values.currentDebt) || 0
    const initialBalance = debt > 0 ? (-debt).toFixed(2) : '0'
    startTransition(async () => {
      const result = await createAccount({
        name: values.name,
        type: 'credit_card',
        currency: values.currency,
        initialBalance,
        creditLimit: values.creditLimit,
        statementDay: values.statementDay
          ? Number.parseInt(values.statementDay, 10)
          : null,
        paymentDay: values.paymentDay
          ? Number.parseInt(values.paymentDay, 10)
          : null,
        bankSlug: values.bankSlug || null,
        cardProductSlug: values.cardProductSlug || null,
        cardBrand: (values.cardBrand as CardBrand | undefined) || null,
        cardLastFour: values.cardLastFour || null,
        cardHolderName: values.cardHolderName || null,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }

      toast.success('Tarjeta registrada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent className="sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle>Nueva tarjeta de crédito</DialogTitle>
        <DialogDescription>
          Banco, producto y datos del cupo. Una tarjeta es más que una cuenta —
          tiene corte, pago y cupo. Finanzia los rastrea.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        {/* Identidad visual — primero porque define imagen + ayuda al nombre */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Banco" error={errors.bankSlug?.message}>
            <Select
              value={bankSlug || NONE}
              onValueChange={(v) => {
                const next = v === NONE ? '' : v
                setValue('bankSlug', next, { shouldValidate: true })
                setValue('cardProductSlug', undefined)
                setValue('cardBrand', undefined)
                // Sugerir nombre con sólo el banco hasta que elija producto.
                const bank = CARD_CATALOG.find((b) => b.slug === next)
                if (bank) maybeSuggestName(bank.name)
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {CARD_CATALOG.map((b) => (
                  <SelectItem key={b.slug} value={b.slug}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Producto" error={errors.cardProductSlug?.message}>
            <Select
              value={cardProductSlug ?? NONE}
              onValueChange={(v) => {
                const next = v === NONE ? undefined : v
                setValue('cardProductSlug', next)
                setValue('cardBrand', undefined)
                const product = productsForBank.find((p) => p.slug === next)
                if (product && selectedBank) {
                  maybeSuggestName(`${selectedBank.name} ${product.name}`)
                }
              }}
              disabled={!selectedBank}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={!selectedBank ? 'Elige banco' : 'Selecciona'}
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {productsForBank.map((p) => (
                  <SelectItem key={p.slug} value={p.slug}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Red" error={errors.cardBrand?.message}>
            <Select
              value={cardBrand ?? NONE}
              onValueChange={(v) =>
                setValue('cardBrand', v === NONE ? undefined : v)
              }
              disabled={brandsForProduct.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    brandsForProduct.length === 0 ? 'Elige producto' : 'Selecciona'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                {brandsForProduct.map((b) => (
                  <SelectItem key={b} value={b}>
                    {BRAND_LABELS[b]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field
            label="Últimos 4"
            htmlFor="last-four"
            error={errors.cardLastFour?.message}
          >
            <Input
              id="last-four"
              inputMode="numeric"
              maxLength={4}
              placeholder="4821"
              className="tabular"
              {...register('cardLastFour', {
                onChange: (e) => {
                  const v = e.target.value as string
                  if (/^\d{4}$/.test(v) && selectedBank) {
                    const base = selectedProduct
                      ? `${selectedBank.name} ${selectedProduct.name}`
                      : selectedBank.name
                    maybeSuggestName(`${base} ···· ${v}`)
                  }
                },
              })}
            />
          </Field>

          <Field
            label="Titular"
            htmlFor="holder-name"
            error={errors.cardHolderName?.message}
          >
            <Input
              id="holder-name"
              placeholder="Daniel Martínez"
              {...register('cardHolderName')}
            />
          </Field>
        </div>

        {/* Preview */}
        {selectedBank && (
          <div className="mx-auto w-full max-w-[360px]">
            <CardVisual
              bankSlug={bankSlug || null}
              kind="credit"
              cardProductSlug={cardProductSlug ?? null}
              cardBrand={cardBrand ?? null}
              cardLastFour={cardLastFour || null}
              cardHolderName={cardHolderName || null}
            />
          </div>
        )}

        {/* Nombre + moneda */}
        <div className="border-border-default flex flex-col gap-4 border-t pt-4">
          <Field
            label="Nombre interno"
            htmlFor="card-name"
            error={errors.name?.message}
            hint="Lo que verás en listas y selects de transacción"
          >
            <Input
              id="card-name"
              placeholder={suggestedName || 'Bancolombia Mastercard ···· 4821'}
              {...register('name')}
            />
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

        {/* Mecánica financiera */}
        <div className="border-border-default flex flex-col gap-4 border-t pt-4">
          <div className="flex flex-col gap-1">
            <h3 className="text-text text-sm font-semibold">Cupo y fechas</h3>
            <p className="text-text-tertiary text-xs">
              Lo que debes ahora va como número positivo; 0 si está al día.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Cupo total"
              htmlFor="credit-limit"
              error={errors.creditLimit?.message}
            >
              <Input
                id="credit-limit"
                inputMode="decimal"
                placeholder="5000000"
                className="tabular"
                {...register('creditLimit')}
              />
            </Field>

            <Field
              label="Saldo adeudado actual"
              htmlFor="current-debt"
              error={errors.currentDebt?.message}
              hint="Lo que debes hoy. 0 si está al día."
            >
              <Input
                id="current-debt"
                inputMode="decimal"
                placeholder="0"
                className="tabular"
                {...register('currentDebt')}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Día de corte"
              htmlFor="statement-day"
              error={errors.statementDay?.message}
              hint="Cuándo cierra el mes"
            >
              <Input
                id="statement-day"
                type="number"
                min={1}
                max={31}
                placeholder="15"
                className="tabular"
                {...register('statementDay')}
              />
            </Field>
            <Field
              label="Día de pago"
              htmlFor="payment-day"
              error={errors.paymentDay?.message}
              hint="Hasta cuándo pagas"
            >
              <Input
                id="payment-day"
                type="number"
                min={1}
                max={31}
                placeholder="5"
                className="tabular"
                {...register('paymentDay')}
              />
            </Field>
          </div>
        </div>

        {serverError && <p className="text-negative text-xs">{serverError}</p>}

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
            {pending ? 'Creando…' : 'Registrar tarjeta'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
