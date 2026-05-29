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
import { BRAND_LABELS, CARD_CATALOG, type CardBrand } from '@/lib/cards/catalog'
import { CardVisual } from '@/components/cards/card-visual'
import { updateCard } from '@/app/(app)/mi-dinero/tarjetas/actions'

const NONE = '__none__'

const schema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80'),
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
  bankSlug: z.string().optional(),
  cardProductSlug: z.string().optional(),
  cardBrand: z.string().optional(),
  cardLastFour: z
    .string()
    .regex(/^\d{4}$/, 'Cuatro dígitos')
    .optional()
    .or(z.literal('')),
  cardHolderName: z.string().trim().max(60).optional(),
})

type FormValues = z.infer<typeof schema>

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  card: {
    id: string
    name: string
    creditLimit: string | null
    statementDay: number | null
    paymentDay: number | null
    bankSlug: string | null
    cardProductSlug: string | null
    cardBrand: string | null
    cardLastFour: string | null
    cardHolderName: string | null
  }
}

export function EditCardDialog({ open, onOpenChange, card }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <EditCardForm card={card} onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function EditCardForm({
  card,
  onDone,
}: {
  card: Props['card']
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
      name: card.name,
      creditLimit: card.creditLimit ?? '',
      statementDay: card.statementDay ? String(card.statementDay) : '',
      paymentDay: card.paymentDay ? String(card.paymentDay) : '',
      bankSlug: card.bankSlug ?? '',
      cardProductSlug: card.cardProductSlug ?? '',
      cardBrand: card.cardBrand ?? '',
      cardLastFour: card.cardLastFour ?? '',
      cardHolderName: card.cardHolderName ?? '',
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

  function onSubmit(values: FormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await updateCard({
        accountId: card.id,
        name: values.name,
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

      toast.success('Tarjeta actualizada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent className="sm:max-w-[640px]">
      <DialogHeader>
        <DialogTitle>Editar tarjeta</DialogTitle>
        <DialogDescription>
          Actualiza el cupo si te lo aumentaron, cambia las fechas si ajustan
          el ciclo, o reasigna la identidad visual.
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
      >
        {/* Identidad visual */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Banco">
            <Select
              value={bankSlug || NONE}
              onValueChange={(v) => {
                const next = v === NONE ? '' : v
                setValue('bankSlug', next)
                setValue('cardProductSlug', '')
                setValue('cardBrand', '')
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

          <Field label="Producto">
            <Select
              value={cardProductSlug || NONE}
              onValueChange={(v) => {
                const next = v === NONE ? '' : v
                setValue('cardProductSlug', next)
                setValue('cardBrand', '')
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
          <Field label="Red">
            <Select
              value={cardBrand || NONE}
              onValueChange={(v) => setValue('cardBrand', v === NONE ? '' : v)}
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
            htmlFor="edit-last-four"
            error={errors.cardLastFour?.message}
          >
            <Input
              id="edit-last-four"
              inputMode="numeric"
              maxLength={4}
              className="tabular"
              {...register('cardLastFour')}
            />
          </Field>

          <Field
            label="Titular"
            htmlFor="edit-holder-name"
            error={errors.cardHolderName?.message}
          >
            <Input id="edit-holder-name" {...register('cardHolderName')} />
          </Field>
        </div>

        {selectedBank && (
          <div className="mx-auto w-full max-w-[240px]">
            <CardVisual
              bankSlug={bankSlug || null}
              kind="credit"
              cardProductSlug={cardProductSlug || null}
              cardBrand={cardBrand || null}
              cardLastFour={cardLastFour || null}
              cardHolderName={cardHolderName || null}
            />
          </div>
        )}

        {/* Datos */}
        <div className="border-border-default flex flex-col gap-4 border-t pt-4">
          <Field
            label="Nombre interno"
            htmlFor="edit-card-name"
            error={errors.name?.message}
          >
            <Input id="edit-card-name" {...register('name')} />
          </Field>

          <Field
            label="Cupo total"
            htmlFor="edit-credit-limit"
            error={errors.creditLimit?.message}
            hint="Si te lo subieron o bajaron, actualízalo acá."
          >
            <Input
              id="edit-credit-limit"
              inputMode="decimal"
              className="tabular"
              {...register('creditLimit')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Día de corte"
              htmlFor="edit-statement-day"
              error={errors.statementDay?.message}
            >
              <Input
                id="edit-statement-day"
                type="number"
                min={1}
                max={31}
                className="tabular"
                {...register('statementDay')}
              />
            </Field>
            <Field
              label="Día de pago"
              htmlFor="edit-payment-day"
              error={errors.paymentDay?.message}
            >
              <Input
                id="edit-payment-day"
                type="number"
                min={1}
                max={31}
                className="tabular"
                {...register('paymentDay')}
              />
            </Field>
          </div>
        </div>

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
