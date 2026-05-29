import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireCurrentUser } from '@/lib/auth'
import { getAccountById } from '@/lib/db/queries/accounts'
import { Amount } from '@/components/app/amount'
import { CardVisual } from '@/components/cards/card-visual'
import { CardActionsMenu } from '@/components/app/card-actions-menu'
import { CreditCardProfilePanel } from '@/components/app/credit-card-profile-panel'
import { PurchaseAnalyzer } from '@/components/app/purchase-analyzer'
import { formatMoney } from '@/lib/currency/format'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

export default async function TarjetaDetailPage({ params }: Props) {
  const { id } = await params
  const user = await requireCurrentUser()
  const account = await getAccountById(user.id, id)

  if (!account) notFound()
  // Si por alguna razón llegan a este detalle con una cuenta que no es
  // tarjeta de crédito, mandarlos al detalle de cuenta.
  if (account.type !== 'credit_card') {
    redirect(`/mi-dinero/cuentas/${id}`)
  }

  const hasCardVisual = Boolean(account.bankSlug)
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

  const cardForActions = {
    id: account.id,
    name: account.name,
    creditLimit: account.creditLimit,
    statementDay: account.statementDay,
    paymentDay: account.paymentDay,
    bankSlug: account.bankSlug,
    cardProductSlug: account.cardProductSlug,
    cardBrand: account.cardBrand,
    cardLastFour: account.cardLastFour,
    cardHolderName: account.cardHolderName,
  }

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      {/* Breadcrumb + título + hero balance + menú de acciones */}
      <header className="flex min-w-0 flex-col gap-1.5">
        <Link
          href="/mi-dinero/tarjetas"
          className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
        >
          ← Tarjetas
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            {account.name}
          </h1>
          <CardActionsMenu card={cardForActions} />
        </div>
        <Amount
          value={account.currentBalance}
          currency={account.currency}
          display
          kind={balance < 0 ? 'negative' : 'neutral'}
          className="mt-2 block truncate text-[28px] sm:text-4xl md:text-5xl lg:text-6xl"
        />
        <p className="text-text-tertiary text-xs">
          Saldo de la tarjeta · {account.currency}
          {account.cardLastFour && ` · ···· ${account.cardLastFour}`}
        </p>
      </header>

      {/* Card visual — siempre presente. Si no hay identidad asignada, el
          placeholder editorial se muestra (banco "tarjeta" + chip "Crédito"). */}
      <section className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-5">
        <div className="mx-auto w-full max-w-[260px]">
          <CardVisual
            bankSlug={account.bankSlug}
            kind="credit"
            cardProductSlug={account.cardProductSlug}
            cardBrand={account.cardBrand}
            cardLastFour={account.cardLastFour}
            cardHolderName={account.cardHolderName}
            showMeta={false}
          />
        </div>
        {!hasCardVisual && (
          <p className="text-text-tertiary text-center text-[12px]">
            Asigna banco y producto desde <span className="text-text-secondary">Gestionar → Editar datos</span>.
          </p>
        )}
      </section>

      {/* Métricas */}
      {account.creditLimit && (
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
              <Fact
                label="Disponible"
                value={formatMoney(available, { currency: account.currency, compact: true })}
              />
              <Fact
                label="Cupo total"
                value={formatMoney(limit, { currency: account.currency, compact: true })}
              />
              {account.statementDay && (
                <Fact
                  label="Corte"
                  value={`día ${account.statementDay} · en ${daysTo(account.statementDay)}d`}
                />
              )}
              {account.paymentDay && (
                <Fact
                  label="Pago"
                  value={`día ${account.paymentDay} · en ${daysTo(account.paymentDay)}d`}
                />
              )}
            </dl>
          </div>
        </section>
      )}

      {/* Perfil + analizador */}
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
