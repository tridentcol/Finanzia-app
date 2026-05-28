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

  const cardKind: CardKind | null =
    account.type === 'credit_card'
      ? 'credit'
      : account.type === 'checking' || account.type === 'savings'
        ? 'debit'
        : null

  const hasCardVisual = Boolean(account.bankSlug && cardKind)

  const isCreditCard = account.type === 'credit_card'

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
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <Link
            href="/cuentas"
            className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors"
          >
            Cuentas
          </Link>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            {account.name}
          </h1>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_360px]">
        {/* Columna principal */}
        <div className="flex flex-col gap-6">
          {/* Card visual + identidad */}
          <div className="border-border-default bg-surface relative flex flex-col gap-5 rounded-[12px] border p-5">
            {cardKind && (
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
            )}

            {hasCardVisual && cardKind && (
              <div className="mx-auto w-full max-w-[320px]">
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
            )}

            <div className="flex flex-col gap-1">
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                Saldo actual
              </span>
              <Amount
                value={account.currentBalance}
                currency={account.currency}
                kind={balance < 0 ? 'negative' : 'neutral'}
                className="text-3xl"
              />
            </div>

            {isCreditCard && account.creditLimit && (
              <div className="border-border-default/60 flex flex-col gap-3 border-t pt-4 text-[13px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-text-tertiary">Utilización</span>
                  <span className="text-text-secondary tabular">
                    {Math.round(utilization * 100)}%
                  </span>
                </div>
                <div className="bg-surface-hover h-1 overflow-hidden rounded-full">
                  <div
                    aria-hidden
                    className={`h-full rounded-full transition-all ${utilizationTone}`}
                    style={{ width: `${utilization * 100}%` }}
                  />
                </div>
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5">
                  <dt className="text-text-tertiary">Disponible</dt>
                  <dd className="text-text-secondary text-right font-mono tabular">
                    {formatMoney(available, { currency: account.currency, compact: true })}
                  </dd>
                  <dt className="text-text-tertiary">Cupo</dt>
                  <dd className="text-text-secondary text-right font-mono tabular">
                    {formatMoney(limit, { currency: account.currency, compact: true })}
                  </dd>
                  {account.statementDay && (
                    <>
                      <dt className="text-text-tertiary">Corte</dt>
                      <dd className="text-text-secondary text-right tabular">
                        día {account.statementDay} · en {daysTo(account.statementDay)}d
                      </dd>
                    </>
                  )}
                  {account.paymentDay && (
                    <>
                      <dt className="text-text-tertiary">Pago</dt>
                      <dd className="text-text-secondary text-right tabular">
                        día {account.paymentDay} · en {daysTo(account.paymentDay)}d
                      </dd>
                    </>
                  )}
                </dl>
              </div>
            )}
          </div>

          {/* Perfil financiero de la tarjeta */}
          {isCreditCard && (
            <CreditCardProfilePanel
              accountId={account.id}
              initial={account.creditCardProfile}
            />
          )}
        </div>

        {/* Columna lateral — analizador de compra */}
        {isCreditCard && (
          <PurchaseAnalyzer
            statementDay={account.statementDay}
            creditLimit={account.creditLimit}
            currentBalance={account.currentBalance}
            interestRateMonthly={account.creditCardProfile?.interestRateMonthly ?? null}
            currency={account.currency}
          />
        )}
      </div>
    </div>
  )
}
