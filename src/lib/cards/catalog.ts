/**
 * Catálogo curado de tarjetas bancarias colombianas.
 *
 * Filosofía: `bankSlug + productSlug` identifican un par único en este
 * catálogo. La UI los presenta como dropdowns cascada (banco → producto →
 * brand) y resuelve `imagePath` para el componente <CardVisual>.
 *
 * Las imágenes viven en `/public/cards/` con la convención de naming:
 *   `{bankSlug}-{kind}-{productSlug}.avif`
 *
 * Si el archivo todavía no existe (porque no lo curamos aún), <CardVisual>
 * cae al placeholder neutral con wordmark del banco — la app no rompe.
 *
 * Para agregar una imagen: drop del archivo en `/public/cards/`, sin código
 * adicional. Para agregar un banco/producto nuevo: extender este catálogo.
 */

export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'diners' | 'other'

export type CardKind = 'credit' | 'debit'

export type CardProduct = {
  slug: string
  name: string
  /** Brands que esta línea de producto realmente emite en Colombia. */
  brands: CardBrand[]
  /** Path relativo desde /public. Puede no existir todavía — fallback graceful. */
  imagePath: string
}

export type CardBank = {
  slug: string
  /** Wordmark canónico para fallbacks y dropdowns. */
  name: string
  creditProducts: CardProduct[]
  debitProducts: CardProduct[]
}

export const CARD_CATALOG: CardBank[] = [
  {
    slug: 'bancolombia',
    name: 'Bancolombia',
    creditProducts: [
      {
        slug: 'mastercard-estandar',
        name: 'Mastercard',
        brands: ['mastercard'],
        imagePath: '/cards/bancolombia-credit-mastercard-estandar.avif',
      },
      {
        slug: 'mastercard-black',
        name: 'Mastercard Black',
        brands: ['mastercard'],
        imagePath: '/cards/bancolombia-credit-mastercard-black.avif',
      },
      {
        slug: 'visa-platinum',
        name: 'Visa Platinum',
        brands: ['visa'],
        imagePath: '/cards/bancolombia-credit-visa-platinum.avif',
      },
      {
        slug: 'amex-gold',
        name: 'American Express Gold',
        brands: ['amex'],
        imagePath: '/cards/bancolombia-credit-amex-gold.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'ahorros',
        name: 'Débito Ahorros',
        brands: ['visa', 'mastercard'],
        imagePath: '/cards/bancolombia-debit-ahorros.avif',
      },
    ],
  },
  {
    slug: 'davivienda',
    name: 'Davivienda',
    creditProducts: [
      {
        slug: 'zero',
        name: 'Zero',
        brands: ['mastercard'],
        imagePath: '/cards/davivienda-credit-zero.avif',
      },
      {
        slug: 'cashback',
        name: 'Cashback',
        brands: ['mastercard'],
        imagePath: '/cards/davivienda-credit-cashback.avif',
      },
      {
        slug: 'visa-platinum',
        name: 'Visa Platinum',
        brands: ['visa'],
        imagePath: '/cards/davivienda-credit-visa-platinum.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'daviplata',
        name: 'DaviPlata',
        brands: ['visa'],
        imagePath: '/cards/davivienda-debit-daviplata.avif',
      },
      {
        slug: 'ahorros',
        name: 'Débito Ahorros',
        brands: ['visa', 'mastercard'],
        imagePath: '/cards/davivienda-debit-ahorros.avif',
      },
    ],
  },
  {
    slug: 'nu',
    name: 'Nu',
    creditProducts: [
      {
        slug: 'mastercard',
        name: 'Nu Mastercard',
        brands: ['mastercard'],
        imagePath: '/cards/nu-credit-mastercard.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'cuenta',
        name: 'Cuenta Nu',
        brands: ['mastercard'],
        imagePath: '/cards/nu-debit-cuenta.avif',
      },
    ],
  },
  {
    slug: 'rappi',
    name: 'RappiCard',
    creditProducts: [
      {
        slug: 'visa',
        name: 'RappiCard Visa',
        brands: ['visa'],
        imagePath: '/cards/rappi-credit-visa.avif',
      },
      {
        slug: 'black',
        name: 'RappiCard Black',
        brands: ['visa'],
        imagePath: '/cards/rappi-credit-black.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'pay',
        name: 'RappiPay',
        brands: ['mastercard'],
        imagePath: '/cards/rappi-debit-pay.avif',
      },
    ],
  },
  {
    slug: 'falabella',
    name: 'Banco Falabella',
    creditProducts: [
      {
        slug: 'cmr',
        name: 'CMR Falabella',
        brands: ['visa', 'mastercard'],
        imagePath: '/cards/falabella-credit-cmr.avif',
      },
    ],
    debitProducts: [],
  },
  {
    slug: 'bbva',
    name: 'BBVA',
    creditProducts: [
      {
        slug: 'aqua',
        name: 'BBVA Aqua',
        brands: ['mastercard'],
        imagePath: '/cards/bbva-credit-aqua.avif',
      },
      {
        slug: 'after',
        name: 'BBVA After',
        brands: ['visa'],
        imagePath: '/cards/bbva-credit-after.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'libreta',
        name: 'Débito Libretón',
        brands: ['visa'],
        imagePath: '/cards/bbva-debit-libreta.avif',
      },
    ],
  },
  {
    slug: 'scotiabank',
    name: 'Scotiabank Colpatria',
    creditProducts: [
      {
        slug: 'gold',
        name: 'Scotia Gold',
        brands: ['visa', 'mastercard'],
        imagePath: '/cards/scotiabank-credit-gold.avif',
      },
      {
        slug: 'platinum',
        name: 'Scotia Platinum',
        brands: ['visa'],
        imagePath: '/cards/scotiabank-credit-platinum.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'ahorros',
        name: 'Débito Ahorros',
        brands: ['mastercard'],
        imagePath: '/cards/scotiabank-debit-ahorros.avif',
      },
    ],
  },
  {
    slug: 'bogota',
    name: 'Banco de Bogotá',
    creditProducts: [
      {
        slug: 'mastercard-black',
        name: 'Mastercard Black',
        brands: ['mastercard'],
        imagePath: '/cards/bogota-credit-mastercard-black.avif',
      },
      {
        slug: 'visa-signature',
        name: 'Visa Signature',
        brands: ['visa'],
        imagePath: '/cards/bogota-credit-visa-signature.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'ahorros',
        name: 'Débito Ahorros',
        brands: ['visa'],
        imagePath: '/cards/bogota-debit-ahorros.avif',
      },
    ],
  },
  {
    slug: 'bancoomeva',
    name: 'Bancoomeva',
    creditProducts: [
      {
        slug: 'visa',
        name: 'Visa Clásica',
        brands: ['visa'],
        imagePath: '/cards/bancoomeva-credit-visa.avif',
      },
      {
        slug: 'mastercard-gold',
        name: 'Mastercard Gold',
        brands: ['mastercard'],
        imagePath: '/cards/bancoomeva-credit-mastercard-gold.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'ahorros',
        name: 'Débito Ahorros',
        brands: ['visa', 'mastercard'],
        imagePath: '/cards/bancoomeva-debit-ahorros.avif',
      },
    ],
  },
  {
    slug: 'avvillas',
    name: 'AV Villas',
    creditProducts: [
      {
        slug: 'mastercard-clasica',
        name: 'Mastercard Clásica',
        brands: ['mastercard'],
        imagePath: '/cards/avvillas-credit-mastercard-clasica.avif',
      },
      {
        slug: 'visa-platinum',
        name: 'Visa Platinum',
        brands: ['visa'],
        imagePath: '/cards/avvillas-credit-visa-platinum.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'ahorros',
        name: 'Débito Ahorros',
        brands: ['mastercard'],
        imagePath: '/cards/avvillas-debit-ahorros.avif',
      },
    ],
  },
  {
    slug: 'itau',
    name: 'Itaú Colombia',
    creditProducts: [
      {
        slug: 'mastercard-gold',
        name: 'Mastercard Gold',
        brands: ['mastercard'],
        imagePath: '/cards/itau-credit-mastercard-gold.avif',
      },
      {
        slug: 'visa-platinum',
        name: 'Visa Platinum',
        brands: ['visa'],
        imagePath: '/cards/itau-credit-visa-platinum.avif',
      },
    ],
    debitProducts: [
      {
        slug: 'ahorros',
        name: 'Débito Ahorros',
        brands: ['visa', 'mastercard'],
        imagePath: '/cards/itau-debit-ahorros.avif',
      },
    ],
  },
  {
    slug: 'nequi',
    name: 'Nequi',
    creditProducts: [],
    debitProducts: [
      {
        slug: 'cuenta',
        name: 'Cuenta Nequi',
        brands: ['mastercard'],
        imagePath: '/cards/nequi-debit-cuenta.avif',
      },
    ],
  },
  {
    slug: 'otro',
    name: 'Otro banco',
    creditProducts: [
      {
        slug: 'generico',
        name: 'Tarjeta genérica',
        brands: ['visa', 'mastercard', 'amex', 'diners', 'other'],
        imagePath: '',
      },
    ],
    debitProducts: [
      {
        slug: 'generico',
        name: 'Débito genérico',
        brands: ['visa', 'mastercard'],
        imagePath: '',
      },
    ],
  },
]

/**
 * Búsqueda directa por slugs. Devuelve `null` si el par no existe.
 */
export function findCardProduct(
  bankSlug: string | null | undefined,
  kind: CardKind,
  productSlug: string | null | undefined,
): { bank: CardBank; product: CardProduct } | null {
  if (!bankSlug || !productSlug) return null
  const bank = CARD_CATALOG.find((b) => b.slug === bankSlug)
  if (!bank) return null
  const list = kind === 'credit' ? bank.creditProducts : bank.debitProducts
  const product = list.find((p) => p.slug === productSlug)
  if (!product) return null
  return { bank, product }
}

export function findBank(bankSlug: string | null | undefined): CardBank | null {
  if (!bankSlug) return null
  return CARD_CATALOG.find((b) => b.slug === bankSlug) ?? null
}

export const BRAND_LABELS: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  diners: 'Diners Club',
  other: 'Otra red',
}
