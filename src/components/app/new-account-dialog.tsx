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
import { createAccount } from '@/app/(app)/cuentas/actions'
import {
  BRAND_LABELS,
  CARD_CATALOG,
  type CardBrand,
  type CardKind,
} from '@/lib/cards/catalog'
import { CardVisual } from '@/components/cards/card-visual'
import { useDialogStore } from './dialog-store'

const accountTypes = [
  { value: 'checking', label: 'Cuenta corriente' },
  { value: 'savings', label: 'Ahorros' },
  { value: 'credit_card', label: 'Tarjeta de crédito' },
  { value: 'cash', label: 'Efectivo' },
  { value: 'investment', label: 'Inversión' },
  { value: 'crypto', label: 'Cripto' },
  { value: 'other', label: 'Otra' },
] as const

const NONE = '__none__'

const schema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80'),
  type: z.enum(accountTypes.map((t) => t.value) as [string, ...string[]]),
  currency: z.enum(currencyCodes as [string, ...string[]]),
  initialBalance: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, 'Formato 1234.56'),
  creditLimit: z.string().optional(),
  statementDay: z.string().optional(),
  paymentDay: z.string().optional(),
  // Card visual identity (opcional)
  bankSlug: z.string().optional(),
  cardProductSlug: z.string().optional(),
  cardBrand: z.string().optional(),
  cardLastFour: z.string().optional(),
  cardHolderName: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

function typeToCardKind(type: string): CardKind | null {
  if (type === 'credit_card') return 'credit'
  if (type === 'checking' || type === 'savings') return 'debit'
  return null
}

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

  const type = watch('type')
  const bankSlug = watch('bankSlug')
  const cardProductSlug = watch('cardProductSlug')
  const cardBrand = watch('cardBrand')
  const cardLastFour = watch('cardLastFour')
  const cardHolderName = watch('cardHolderName')

  const isCreditCard = type === 'credit_card'
  const cardKind = typeToCardKind(type)
  const allowsCardVisual = cardKind !== null

  const selectedBank = useMemo(
    () => (bankSlug ? CARD_CATALOG.find((b) => b.slug === bankSlug) : null),
    [bankSlug],
  )

  const productsForBank = useMemo(() => {
    if (!selectedBank || !cardKind) return []
    return cardKind === 'credit'
      ? selectedBank.creditProducts
      : selectedBank.debitProducts
  }, [selectedBank, cardKind])

  const selectedProduct = useMemo(
    () =>
      productsForBank.find((p) => p.slug === cardProductSlug) ?? null,
    [productsForBank, cardProductSlug],
  )

  const brandsForProduct = selectedProduct?.brands ?? []

  function onSubmit(values: FormValues) {
    setServerError(null)
    const showCardVisual = allowsCardVisual && Boolean(values.bankSlug)
    startTransition(async () => {
      const result = await createAccount({
        name: values.name,
        type: values.type as 'checking',
        currency: values.currency,
        initialBalance: values.initialBalance,
        creditLimit: isCreditCard && values.creditLimit ? values.creditLimit : null,
        statementDay:
          isCreditCard && values.statementDay
            ? Number.parseInt(values.statementDay, 10)
            : null,
        paymentDay:
          isCreditCard && values.paymentDay
            ? Number.parseInt(values.paymentDay, 10)
            : null,
        bankSlug: showCardVisual ? (values.bankSlug ?? null) : null,
        cardProductSlug: showCardVisual ? (values.cardProductSlug ?? null) : null,
        cardBrand: showCardVisual
          ? ((values.cardBrand as CardBrand | undefined) ?? null)
          : null,
        cardLastFour: showCardVisual ? (values.cardLastFour || null) : null,
        cardHolderName: showCardVisual ? (values.cardHolderName || null) : null,
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
    <DialogContent className="sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle>Nueva cuenta</DialogTitle>
        <DialogDescription>
          Cada movimiento se asienta sobre una cuenta. Define una corriente,
          una de ahorros o una tarjeta para empezar.
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
              onValueChange={(v) => {
                setValue('type', v, { shouldValidate: true })
                // Resetea identidad visual si el tipo no la admite.
                if (typeToCardKind(v) === null) {
                  setValue('bankSlug', undefined)
                  setValue('cardProductSlug', undefined)
                  setValue('cardBrand', undefined)
                }
              }}
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
          label={isCreditCard ? 'Saldo a deuda (negativo si debes)' : 'Saldo inicial'}
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

        {isCreditCard && (
          <div className="grid grid-cols-3 gap-3">
            <Field
              label="Cupo"
              htmlFor="credit-limit"
              error={errors.creditLimit?.message}
              className="col-span-3"
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
              label="Día de corte"
              htmlFor="statement-day"
              error={errors.statementDay?.message}
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
        )}

        {allowsCardVisual && (
          <div className="border-border-default flex flex-col gap-4 border-t pt-4">
            <div className="flex flex-col gap-1">
              <h3 className="text-text text-sm font-semibold">
                Identidad visual
              </h3>
              <p className="text-text-tertiary text-xs">
                Opcional. Elige tu banco y producto para que la tarjeta se vea
                tal como la conoces.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Banco" error={errors.bankSlug?.message}>
                <Select
                  value={bankSlug ?? NONE}
                  onValueChange={(v) => {
                    const next = v === NONE ? undefined : v
                    setValue('bankSlug', next)
                    setValue('cardProductSlug', undefined)
                    setValue('cardBrand', undefined)
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NONE}>Sin imagen</SelectItem>
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
                  }}
                  disabled={!selectedBank || productsForBank.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        !selectedBank
                          ? 'Elige banco primero'
                          : productsForBank.length === 0
                            ? 'Sin productos'
                            : 'Selecciona'
                      }
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
                        brandsForProduct.length === 0
                          ? 'Elige producto'
                          : 'Selecciona'
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
                  {...register('cardLastFour')}
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

            {(bankSlug || selectedProduct) && cardKind && (
              <div className="mx-auto w-full max-w-[360px]">
                <CardVisual
                  bankSlug={bankSlug ?? null}
                  kind={cardKind}
                  cardProductSlug={cardProductSlug ?? null}
                  cardBrand={cardBrand ?? null}
                  cardLastFour={cardLastFour ?? null}
                  cardHolderName={cardHolderName ?? null}
                />
              </div>
            )}
          </div>
        )}

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
