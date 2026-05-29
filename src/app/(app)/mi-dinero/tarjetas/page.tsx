import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { getRatesForPairs } from '@/lib/currency/rates'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import { NewCardTrigger } from '@/components/app/new-card-trigger'
import { CardVisual } from '@/components/cards/card-visual'
import { EditCardVisualDialog } from '@/components/app/edit-card-visual-dialog'
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
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const accountsList = await listAccountsWithBalance(user.id)
  const cards = accountsList.filter((a) => a.type === 'credit_card')

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
  const today = new Date().toISOString().slice(0, 10)
  const nonBase = cards.filter((c) => c.currency !== baseCurrency)
  const rates =
    nonBase.length > 0
      ? await getRatesForPairs(
          nonBase.map((c) => ({ from: c.currency, to: baseCurrency })),
          today,
        )
      : new Map<string, string>()

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
  const limit = Number.parseFloat(c.creditLimit ?? '0')
  const balance = Number.parseFloat(c.currentBalance)
  const used = balance < 0 ? -balance : 0
  const available = limit - used
  const utilization = limit > 0 ? Math.min(1, used / limit) : 0
  const tone =
    utilization >= 0.9
      ? 'bg-negative'
      : utilization >= 0.6
        ? 'bg-warning'
        : 'bg-text'
  const stD = daysToMonthDay(c.statementDay)
  const pyD = daysToMonthDay(c.paymentDay)

  return (
    <article className="border-border-default bg-surface relative flex min-w-0 flex-col gap-5 rounded-[12px] border p-5">
      <EditCardVisualDialog
        accountId={c.id}
        accountName={c.name}
        cardKind="credit"
        initial={{
          bankSlug: c.bankSlug,
          cardProductSlug: c.cardProductSlug,
          cardBrand: c.cardBrand,
          cardLastFour: c.cardLastFour,
          cardHolderName: c.cardHolderName,
        }}
      />

      <div className="mx-auto w-full max-w-[260px]">
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

      <header className="flex items-start justify-between gap-3">
        <Link
          href={`/mi-dinero/tarjetas/${c.id}`}
          className="flex min-w-0 flex-col gap-0.5 hover:opacity-80 transition-opacity"
        >
          <span className="text-text truncate text-sm font-semibold">
            {c.name}
          </span>
          <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            {c.cardLastFour ? `···· ${c.cardLastFour}` : 'Tarjeta de crédito'}
          </span>
        </Link>
        <span className="text-text-tertiary shrink-0 text-[11px] tracking-wider">
          {c.currency}
        </span>
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Adeudado
        </span>
        <Amount
          value={String(used)}
          currency={c.currency}
          kind={used > 0 ? 'negative' : 'neutral'}
          className="text-2xl"
        />
      </div>

      {limit > 0 && (
        <div className="border-border-default/60 flex flex-col gap-3 border-t pt-3 text-[12px]">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-text-tertiary">Utilizado</span>
            <span className="text-text-secondary tabular">
              {Math.round(utilization * 100)}%
            </span>
          </div>
          <div className="bg-surface-hover h-1 overflow-hidden rounded-full">
            <div
              aria-hidden
              className={`h-full rounded-full transition-all ${tone}`}
              style={{ width: `${utilization * 100}%` }}
            />
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
            <dt className="text-text-tertiary">Disponible</dt>
            <dd className="text-text-secondary truncate text-right tabular">
              {formatMoney(available, { currency: c.currency, compact: true })}
            </dd>
            <dt className="text-text-tertiary">Cupo</dt>
            <dd className="text-text-secondary truncate text-right tabular">
              {formatMoney(limit, { currency: c.currency, compact: true })}
            </dd>
            {c.statementDay && (
              <>
                <dt className="text-text-tertiary">Corte</dt>
                <dd className="text-text-secondary truncate text-right tabular">
                  día {c.statementDay} · {stD === null ? '' : formatDaysShort(stD)}
                </dd>
              </>
            )}
            {c.paymentDay && (
              <>
                <dt className="text-text-tertiary">Pago</dt>
                <dd className="text-text-secondary truncate text-right tabular">
                  día {c.paymentDay} · {pyD === null ? '' : formatDaysShort(pyD)}
                </dd>
              </>
            )}
          </dl>
        </div>
      )}

      <Link
        href={`/mi-dinero/tarjetas/${c.id}`}
        className="text-text-secondary hover:text-text border-border-default/60 -mb-1 inline-flex items-center justify-between border-t pt-3 text-[13px] transition-colors"
      >
        Detalle
        <span className="text-text-tertiary text-[11px]" aria-hidden>
          →
        </span>
      </Link>
    </article>
  )
}
