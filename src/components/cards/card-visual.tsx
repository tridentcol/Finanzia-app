'use client'

import { useState } from 'react'
import Image from 'next/image'

import {
  BRAND_LABELS,
  findBank,
  findCardProduct,
  type CardBrand,
  type CardKind,
} from '@/lib/cards/catalog'
import { cn } from '@/lib/utils'

type Props = {
  bankSlug: string | null | undefined
  kind: CardKind
  cardProductSlug: string | null | undefined
  cardBrand: string | null | undefined
  cardLastFour?: string | null
  cardHolderName?: string | null
  className?: string
  /** Si false, oculta los datos del usuario debajo de la imagen. Default true. */
  showMeta?: boolean
}

/**
 * Renderiza la tarjeta como recurso visual. La imagen del banco viene del
 * catálogo curado (`src/lib/cards/catalog.ts`) — Finanzia nunca dibuja sobre
 * ella. Los datos del usuario (last4, holder name) se renderizan abajo en
 * tipografía sobria.
 *
 * Si la imagen del catálogo todavía no existe en disco (path vacío o 404),
 * cae al placeholder neutral con wordmark sin romper el layout. Esto permite
 * iterar — primero el código, luego el dropeo de las imágenes a /public/cards/.
 *
 * Aspect ratio 1.585:1 (CR-80 ISO/IEC 7810). Ancho controlado por el padre.
 */
export function CardVisual({
  bankSlug,
  kind,
  cardProductSlug,
  cardBrand,
  cardLastFour,
  cardHolderName,
  className,
  showMeta = true,
}: Props) {
  const [imageBroken, setImageBroken] = useState(false)
  const found = findCardProduct(bankSlug, kind, cardProductSlug)
  const bank = found?.bank ?? findBank(bankSlug)
  const product = found?.product
  const showImage = Boolean(product?.imagePath) && !imageBroken
  const brandLabel =
    cardBrand && cardBrand in BRAND_LABELS
      ? BRAND_LABELS[cardBrand as CardBrand]
      : null

  return (
    <div className={cn('flex flex-col gap-2.5', className)}>
      <div className="border-border-default bg-surface relative aspect-[1.585/1] w-full overflow-hidden rounded-[12px] border">
        {showImage && product ? (
          <Image
            src={product.imagePath}
            alt={`${bank?.name ?? ''} ${product.name}`.trim()}
            fill
            sizes="(max-width: 768px) 90vw, 360px"
            className="object-cover"
            onError={() => setImageBroken(true)}
          />
        ) : (
          <CardPlaceholder bankName={bank?.name} productName={product?.name} />
        )}
      </div>

      {showMeta && (cardLastFour || cardHolderName || brandLabel) && (
        <div className="text-text-tertiary flex flex-wrap items-baseline gap-x-3 gap-y-1 text-[11px] tracking-[0.08em]">
          {cardLastFour && (
            <span className="text-text-secondary font-mono">
              ···· {cardLastFour}
            </span>
          )}
          {cardHolderName && (
            <span className="truncate uppercase">{cardHolderName}</span>
          )}
          {brandLabel && !showImage && (
            <span className="ml-auto uppercase">{brandLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}

function CardPlaceholder({
  bankName,
  productName,
}: {
  bankName?: string
  productName?: string
}) {
  return (
    <div className="bg-surface-hover absolute inset-0 flex flex-col justify-end p-5">
      <span className="text-text text-[15px] font-semibold tracking-tight">
        {bankName ?? 'Tarjeta'}
      </span>
      {productName && (
        <span className="text-text-tertiary text-[11px]">{productName}</span>
      )}
    </div>
  )
}
