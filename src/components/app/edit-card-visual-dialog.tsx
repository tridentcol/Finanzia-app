'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import {
  BRAND_LABELS,
  CARD_CATALOG,
  type CardBrand,
  type CardKind,
} from '@/lib/cards/catalog'
import { CardVisual } from '@/components/cards/card-visual'
import { updateAccountCardVisual } from '@/app/(app)/cuentas/actions'
import { icons } from '@/lib/design/icons'

const NONE = '__none__'

type Props = {
  accountId: string
  accountName: string
  cardKind: CardKind
  initial: {
    bankSlug: string | null
    cardProductSlug: string | null
    cardBrand: string | null
    cardLastFour: string | null
    cardHolderName: string | null
  }
  /** Estilo del botón disparador. */
  variant?: 'pencil' | 'inline'
}

export function EditCardVisualDialog({
  accountId,
  accountName,
  cardKind,
  initial,
  variant = 'pencil',
}: Props) {
  const [open, setOpen] = useState(false)
  const Pencil = icons.pencil

  return (
    <>
      {variant === 'pencil' ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-text-tertiary hover:text-text-secondary hover:bg-surface-hover absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-md transition-colors"
          aria-label="Editar identidad visual"
        >
          <Pencil strokeWidth={1.5} className="h-3.5 w-3.5" />
        </button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
        >
          <Pencil strokeWidth={1.5} className="mr-1.5 h-3.5 w-3.5" />
          Asignar identidad visual
        </Button>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        {open && (
          <EditCardVisualForm
            accountId={accountId}
            accountName={accountName}
            cardKind={cardKind}
            initial={initial}
            onDone={() => setOpen(false)}
          />
        )}
      </Dialog>
    </>
  )
}

function EditCardVisualForm({
  accountId,
  accountName,
  cardKind,
  initial,
  onDone,
}: Props & { onDone: () => void }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const [bankSlug, setBankSlug] = useState<string | undefined>(initial.bankSlug ?? undefined)
  const [cardProductSlug, setCardProductSlug] = useState<string | undefined>(
    initial.cardProductSlug ?? undefined,
  )
  const [cardBrand, setCardBrand] = useState<string | undefined>(initial.cardBrand ?? undefined)
  const [cardLastFour, setCardLastFour] = useState(initial.cardLastFour ?? '')
  const [cardHolderName, setCardHolderName] = useState(initial.cardHolderName ?? '')

  const selectedBank = useMemo(
    () => (bankSlug ? CARD_CATALOG.find((b) => b.slug === bankSlug) : null),
    [bankSlug],
  )

  const productsForBank = useMemo(() => {
    if (!selectedBank) return []
    return cardKind === 'credit' ? selectedBank.creditProducts : selectedBank.debitProducts
  }, [selectedBank, cardKind])

  const selectedProduct = useMemo(
    () => productsForBank.find((p) => p.slug === cardProductSlug) ?? null,
    [productsForBank, cardProductSlug],
  )

  const brandsForProduct = selectedProduct?.brands ?? []

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    startTransition(async () => {
      const result = await updateAccountCardVisual({
        accountId,
        bankSlug: bankSlug ?? null,
        cardProductSlug: cardProductSlug ?? null,
        cardBrand: (cardBrand as CardBrand | undefined) ?? null,
        cardLastFour: cardLastFour || null,
        cardHolderName: cardHolderName || null,
      })

      if (!result.ok) {
        toast.error(result.error.message)
        return
      }

      toast.success('Identidad visual actualizada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent className="sm:max-w-[560px]">
      <DialogHeader>
        <DialogTitle>Identidad visual — {accountName}</DialogTitle>
        <DialogDescription>
          Elige tu banco y producto para que la tarjeta se vea tal como la conoces.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Banco">
            <Select
              value={bankSlug ?? NONE}
              onValueChange={(v) => {
                setBankSlug(v === NONE ? undefined : v)
                setCardProductSlug(undefined)
                setCardBrand(undefined)
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
              value={cardProductSlug ?? NONE}
              onValueChange={(v) => {
                setCardProductSlug(v === NONE ? undefined : v)
                setCardBrand(undefined)
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
          <Field label="Red">
            <Select
              value={cardBrand ?? NONE}
              onValueChange={(v) => setCardBrand(v === NONE ? undefined : v)}
              disabled={brandsForProduct.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={brandsForProduct.length === 0 ? 'Elige producto' : 'Selecciona'}
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

          <Field label="Últimos 4" htmlFor="cv-last-four">
            <Input
              id="cv-last-four"
              inputMode="numeric"
              maxLength={4}
              placeholder="4821"
              className="tabular"
              value={cardLastFour}
              onChange={(e) => setCardLastFour(e.target.value)}
            />
          </Field>

          <Field label="Titular" htmlFor="cv-holder">
            <Input
              id="cv-holder"
              placeholder="Daniel Martínez"
              value={cardHolderName}
              onChange={(e) => setCardHolderName(e.target.value)}
            />
          </Field>
        </div>

        {(bankSlug || selectedProduct) && (
          <div className="mx-auto w-full max-w-[320px]">
            <CardVisual
              bankSlug={bankSlug ?? null}
              kind={cardKind}
              cardProductSlug={cardProductSlug ?? null}
              cardBrand={cardBrand ?? null}
              cardLastFour={cardLastFour || null}
              cardHolderName={cardHolderName || null}
            />
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
