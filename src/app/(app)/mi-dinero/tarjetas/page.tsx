import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { getTarjetasData } from '@/lib/db/queries/cards'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import { NewCardTrigger } from '@/components/app/new-card-trigger'
import { CardVisual } from '@/components/cards/card-visual'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Tarjetas',
}

type CardRow = Awaited<ReturnType<typeof listAccountsWithBalance>>[number]

function daysToMonthDay(target: number | null): number | null {
  if (!target) return null
  const today = new Date().getUTCDate()
  const diff = target - today
  return diff >= 0 ? diff : diff + 30
}

export default async function TarjetasPage() {
  const user = await requireCurrentUser()
  const profile = await getProfile(user.id)
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const today = new Date().toISOString().slice(0, 10)
  const { cards, ratesObj } = await getTarjetasData(user.id, baseCurrency, today)

  if (cards.length === 0) {
    return (
      <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
        <Header baseCurrency={baseCurrency} totalDebt="0" partial={false} cards={[]} />
        <EmptyState
          headline="Aún no registraste ninguna tarjeta."
          body="Agrega una para ver cupos, cortes, próximos pagos y simular compras. Las tarjetas viven separadas de tus cuentas — tienen su propia mecánica."
          action={<NewCardTrigger />}
        />
      </div>
    )
  }

  // Convertir saldo de cada tarjeta a base currency. Las tarjetas pueden estar
  // en moneda distinta del usuario (e.g. visa USD).
  const rates = new Map(Object.entries(ratesObj))

  function toBase(amount: number, currency: string): number {
    if (currency === baseCurrency) return amount
    const rate = rates.get(`${currency}->${baseCurrency}`)
    if (!rate) return amount
    return amount * Number.parseFloat(rate)
  }

  // Métricas globales.
  let totalDebtBase = 0
  let totalLimitBase = 0
  let totalUsedBase = 0
  let partial = false
  let nearestStatement: { name: string; days: number } | null = null

  for (const c of cards) {
    const balance = Number.parseFloat(c.currentBalance)
    const used = balance < 0 ? -balance : 0
    const limit = Number.parseFloat(c.creditLimit ?? '0')

    if (c.currency !== baseCurrency && !rates.get(`${c.currency}->${baseCurrency}`)) {
      partial = true
    }
    totalDebtBase += toBase(used, c.currency)
    if (limit > 0) {
      totalLimitBase += toBase(limit, c.currency)
      totalUsedBase += toBase(used, c.currency)
    }
    const days = daysToMonthDay(c.statementDay)
    if (days !== null && (!nearestStatement || days < nearestStatement.days)) {
      nearestStatement = { name: c.name, days }
    }
  }

  const totalAvailableBase = Math.max(0, totalLimitBase - totalUsedBase)
  const avgUtilization = totalLimitBase > 0 ? totalUsedBase / totalLimitBase : 0

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <Header
        baseCurrency={baseCurrency}
        totalDebt={totalDebtBase.toFixed(2)}
        partial={partial}
        cards={cards}
      />

      {/* Mini stats */}
      <section className="border-border-default grid grid-cols-1 gap-0 overflow-hidden rounded-[12px] border sm:grid-cols-3">
        <Stat
          label="Cupo disponible"
          value={formatMoney(totalAvailableBase, {
            currency: baseCurrency,
            compact: true,
          })}
          sub={`${formatMoney(totalLimitBase, { currency: baseCurrency, compact: true })} total`}
        />
        <Stat
          label="Utilización promedio"
          value={`${Math.round(avgUtilization * 100)}%`}
          sub="ponderada por cupo"
        />
        <Stat
          label="Próximo corte"
          value={nearestStatement ? formatDaysShort(nearestStatement.days) : '—'}
          sub={nearestStatement?.name ?? 'sin tarjetas con día de corte'}
          last
        />
      </section>

      {/* Lista — grid de 1/2/3 columnas según ancho. La CardVisual interior
          tiene max-w para no inflar verticalmente. */}
      <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <li key={c.id} className="min-w-0">
            <CardListItem card={c} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function Header({
  baseCurrency,
  totalDebt,
  partial,
  cards,
}: {
  baseCurrency: CurrencyCode
  totalDebt: string
  partial: boolean
  cards: CardRow[]
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary text-sm">Deuda total en tarjetas</p>
        <Amount
          value={totalDebt}
          currency={baseCurrency}
          display
          kind="neutral"
          className="block truncate text-[28px] sm:text-4xl md:text-5xl"
        />
        <p className="text-text-tertiary text-xs">
          {cards.length} {cards.length === 1 ? 'tarjeta' : 'tarjetas'}
          {partial && ' · conversión parcial'}
        </p>
      </div>
      <NewCardTrigger />
    </header>
  )
}

function Stat({
  label,
  value,
  sub,
  last,
}: {
  label: string
  value: string
  sub: string
  last?: boolean
}) {
  return (
    <div
      className={`flex flex-col gap-1 p-5 ${
        last
          ? 'sm:border-l-0'
          : 'border-border-default border-b sm:border-r sm:border-b-0'
      } border-border-default`}
    >
      <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
        {label}
      </span>
      <span className="text-text amount text-xl font-medium">{value}</span>
      <span className="text-text-tertiary truncate text-[11px]">{sub}</span>
    </div>
  )
}

function formatDaysShort(days: number): string {
  if (days === 0) return 'hoy'
  if (days === 1) return 'mañana'
  return `en ${days}d`
}

function CardListItem({ card: c }: { card: CardRow }) {
  // Listado compacto: sólo la tarjeta + link al detalle. Saldo, cupo,
  // utilización y fechas viven en /mi-dinero/tarjetas/[id] — entrar al
  // detalle es un solo tap.
  return (
    <Link
      href={`/mi-dinero/tarjetas/${c.id}`}
      className="group flex min-w-0 flex-col gap-3 transition-opacity hover:opacity-90"
    >
      <div className="w-full">
        <CardVisual
          bankSlug={c.bankSlug}
          kind="credit"
          cardProductSlug={c.cardProductSlug}
          cardBrand={c.cardBrand}
          cardLastFour={c.cardLastFour}
          cardHolderName={c.cardHolderName}
          showMeta={false}
        />
      </div>
      <div className="flex items-baseline justify-between gap-3 px-1">
        <span className="text-text truncate text-[13px] font-medium">
          {c.name}
        </span>
        <span className="text-text-tertiary group-hover:text-text-secondary inline-flex items-center gap-1 text-[12px] transition-colors">
          Ver detalle
          <span aria-hidden>→</span>
        </span>
      </div>
    </Link>
  )
}
