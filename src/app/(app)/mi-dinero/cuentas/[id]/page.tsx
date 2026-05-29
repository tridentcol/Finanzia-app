import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { requireCurrentUser } from '@/lib/auth'
import { getAccountById } from '@/lib/db/queries/accounts'
import { Amount } from '@/components/app/amount'
import { CardVisual } from '@/components/cards/card-visual'
import { EditCardVisualDialog } from '@/components/app/edit-card-visual-dialog'
import { formatMoney } from '@/lib/currency/format'
import type { CardKind } from '@/lib/cards/catalog'
import { CreditCardProfilePanel } from './credit-card-profile-panel'
import { PurchaseAnalyzer } from './purchase-analyzer'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

export default async function CuentaDetailPage({ params }: Props) {
  const { id } = await params
  const user = await requireCurrentUser()
  const account = await getAccountById(user.id, id)

  if (!account) notFound()

  // La identidad visual es exclusiva de tarjetas de crédito. Las cuentas
  // (checking, savings, etc.) ya no la usan — la cuenta es la cuenta, la
  // tarjeta es algo distinto.
  const isCreditCard = account.type === 'credit_card'
  const cardKind: CardKind | null = isCreditCard ? 'credit' : null
  const hasCardVisual = Boolean(account.bankSlug && isCreditCard)

  const limit = account.creditLimit ? Number.parseFloat(account.creditLimit) : 0
  const balance = Number.parseFloat(account.currentBalance)
  const usedNow = balance < 0 ? -balance : 0
  const available = limit - usedNow
  const utilization = limit > 0 ? Math.min(1, usedNow / limit) : 0
  const utilizationTone =
    utilization >= 0.9 ? 'bg-negative' : utilization >= 0.6 ? 'bg-warning' : 'bg-text'

  const todayDay = new Date().getUTCDate()
  const daysTo = (target: number | null): number | null => {
    if (!target) return null
    const diff = target - todayDay
    return diff >= 0 ? diff : diff + 30
  }

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      {/* Breadcrumb + título + hero balance */}
      <header className="flex min-w-0 flex-col gap-1.5">
        <Link
          href="/mi-dinero/cuentas"
          className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
        >
          ← Cuentas
        </Link>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {account.name}
        </h1>
        <Amount
          value={account.currentBalance}
          currency={account.currency}
          display
          kind={balance < 0 ? 'negative' : 'neutral'}
          className="mt-2 block truncate text-[28px] sm:text-4xl md:text-5xl lg:text-6xl"
        />
        <p className="text-text-tertiary text-xs">
          {isCreditCard ? 'Saldo de la tarjeta' : 'Saldo actual'} · {account.currency}
          {account.cardLastFour && ` · ···· ${account.cardLastFour}`}
        </p>
      </header>

      {/* Card visual destacada — sólo si hay imagen */}
      {hasCardVisual && cardKind && (
        <section className="border-border-default bg-surface relative flex flex-col gap-4 rounded-[12px] border p-6">
          <EditCardVisualDialog
            accountId={account.id}
            accountName={account.name}
            cardKind={cardKind}
            initial={{
              bankSlug: account.bankSlug,
              cardProductSlug: account.cardProductSlug,
              cardBrand: account.cardBrand,
              cardLastFour: account.cardLastFour,
              cardHolderName: account.cardHolderName,
            }}
          />
          <div className="mx-auto w-full max-w-[340px]">
            <CardVisual
              bankSlug={account.bankSlug}
              kind={cardKind}
              cardProductSlug={account.cardProductSlug}
              cardBrand={account.cardBrand}
              cardLastFour={account.cardLastFour}
              cardHolderName={account.cardHolderName}
              showMeta={false}
            />
          </div>
        </section>
      )}

      {/* Si no hay card visual pero es tarjeta/cuenta editable */}
      {!hasCardVisual && cardKind && (
        <section className="border-border-default border-dashed flex flex-col items-center gap-3 rounded-[12px] border p-8 text-center">
          <p className="text-text-secondary text-sm max-w-prose">
            Esta cuenta aún no tiene identidad visual asignada.
          </p>
          <EditCardVisualDialog
            accountId={account.id}
            accountName={account.name}
            cardKind={cardKind}
            variant="inline"
            initial={{
              bankSlug: account.bankSlug,
              cardProductSlug: account.cardProductSlug,
              cardBrand: account.cardBrand,
              cardLastFour: account.cardLastFour,
              cardHolderName: account.cardHolderName,
            }}
          />
        </section>
      )}

      {/* Métricas de tarjeta */}
      {isCreditCard && account.creditLimit && (
        <section className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between">
            <h2 className="text-text text-sm font-semibold">Estado del cupo</h2>
            <span className="text-text-tertiary tabular-nums text-[11px] uppercase tracking-[0.08em]">
              {Math.round(utilization * 100)}% utilizado
            </span>
          </header>
          <div className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-5">
            <div className="bg-surface-hover h-1.5 overflow-hidden rounded-full">
              <div
                aria-hidden
                className={`h-full rounded-full transition-all ${utilizationTone}`}
                style={{ width: `${utilization * 100}%` }}
              />
            </div>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-[13px] sm:grid-cols-4">
              <Fact label="Disponible" value={formatMoney(available, { currency: account.currency, compact: true })} />
              <Fact label="Cupo total" value={formatMoney(limit, { currency: account.currency, compact: true })} />
              {account.statementDay && (
                <Fact label="Corte" value={`día ${account.statementDay} · en ${daysTo(account.statementDay)}d`} />
              )}
              {account.paymentDay && (
                <Fact label="Pago" value={`día ${account.paymentDay} · en ${daysTo(account.paymentDay)}d`} />
              )}
            </dl>
          </div>
        </section>
      )}

      {/* Layout principal: perfil + analizador */}
      {isCreditCard && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
          <CreditCardProfilePanel
            accountId={account.id}
            initial={account.creditCardProfile}
          />
          <PurchaseAnalyzer
            statementDay={account.statementDay}
            creditLimit={account.creditLimit}
            currentBalance={account.currentBalance}
            interestRateMonthly={account.creditCardProfile?.interestRateMonthly ?? null}
            currency={account.currency}
          />
        </div>
      )}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">{label}</dt>
      <dd className="text-text-secondary font-mono tabular-nums">{value}</dd>
    </div>
  )
}
