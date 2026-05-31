import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { listDebts, getDebtsSummary } from '@/lib/db/queries/debts'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import { NewDebtTrigger } from '@/components/app/new-debt-trigger'
import { DebtActionsMenu } from '@/components/app/debt-actions-menu'
import { formatMoney } from '@/lib/currency/format'
import { icons, type IconName } from '@/lib/design/icons'
import type { CurrencyCode } from '@/lib/currency/currencies'
import type { Debt } from '@/lib/db/schema'

export const metadata: Metadata = {
  title: 'Deudas',
}

const debtTypeMeta: Record<
  Debt['type'],
  { label: string; icon: IconName }
> = {
  loan_personal: { label: 'Préstamo personal', icon: 'banknote' },
  mortgage: { label: 'Hipoteca', icon: 'building' },
  auto_loan: { label: 'Crédito vehicular', icon: 'car-front' },
  student_loan: { label: 'Crédito educativo', icon: 'graduation-cap' },
  family_loan: { label: 'Préstamo familiar', icon: 'hand-heart' },
  other: { label: 'Otra deuda', icon: 'circle' },
}

function daysUntil(dateIso: string | null): number | null {
  if (!dateIso) return null
  const target = new Date(`${dateIso}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  return diff
}

export default async function DeudasPage() {
  const user = await requireCurrentUser()
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const [accountsList, debtsList, summary] = await Promise.all([
    listAccountsWithBalance(user.id),
    listDebts(user.id),
    getDebtsSummary(user.id, baseCurrency),
  ])

  // Total deuda en tarjetas (saldo negativo = lo adeudado). Solo se usa
  // para el KPI hero de contexto — el detalle de tarjetas vive en
  // /mi-dinero/tarjetas, así que no se duplica acá.
  const creditCards = accountsList.filter((a) => a.type === 'credit_card')
  const totalCreditCardDebt = creditCards.reduce((sum, c) => {
    const balance = Number.parseFloat(c.currentBalance)
    return balance < 0 ? sum + Math.abs(balance) : sum
  }, 0)

  const activeDebts = debtsList.filter((d) => d.status === 'active')
  const archivedOrPaid = debtsList.filter((d) => d.status !== 'active')

  const isEmpty = debtsList.length === 0

  // KPI unificado: deuda total = préstamos formales + saldos negativos de tarjetas.
  // Las tarjetas viven en /mi-dinero/tarjetas, pero la cifra global vive aquí.
  const totalDebtUnified =
    Number.parseFloat(summary.totalBalanceInBase) + totalCreditCardDebt

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-text-secondary text-sm">Deuda total</p>
          <Amount
            value={totalDebtUnified.toFixed(2)}
            currency={baseCurrency}
            display
            kind="neutral"
            className="block truncate text-[28px] sm:text-4xl md:text-5xl"
          />
          <p className="text-text-tertiary text-xs">
            {summary.activeCount}{' '}
            {summary.activeCount === 1 ? 'préstamo activo' : 'préstamos activos'}
            {creditCards.length > 0 && (
              <>
                {' · '}
                {formatMoney(totalCreditCardDebt, {
                  currency: baseCurrency,
                  compact: true,
                })}{' '}
                en tarjetas
              </>
            )}
            {summary.partial && ' · conversión parcial'}
          </p>
          <p className="text-text-tertiary mt-2 max-w-prose text-[12px] leading-relaxed">
            Préstamos, hipotecas y otras deudas con calendario de pagos. Las
            tarjetas tienen su propia mecánica — viven en{' '}
            <Link
              href="/mi-dinero/tarjetas"
              className="text-text-secondary hover:text-text underline-offset-2 hover:underline"
            >
              Tarjetas
            </Link>
            .
          </p>
        </div>
        <NewDebtTrigger />
      </header>

      {/* Próximo pago destacado */}
      {summary.nextPayment && (
        <section className="border-border-default bg-surface rounded-[12px] border p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                Próximo pago
              </span>
              <span className="text-text text-base font-medium">
                {summary.nextPayment.debtName}
              </span>
              <span className="text-text-secondary text-sm">
                {(() => {
                  const days = daysUntil(summary.nextPayment.date)
                  if (days === null) return summary.nextPayment.date
                  if (days < 0) return `${summary.nextPayment.date} · vencido`
                  if (days === 0) return `${summary.nextPayment.date} · hoy`
                  if (days === 1) return `${summary.nextPayment.date} · mañana`
                  return `${summary.nextPayment.date} · en ${days} días`
                })()}
              </span>
            </div>
            {summary.nextPayment.amount && (
              <Amount
                value={summary.nextPayment.amount}
                currency={summary.nextPayment.currency as CurrencyCode}
                kind="neutral"
                className="text-2xl"
              />
            )}
          </div>
        </section>
      )}

      {isEmpty ? (
        <EmptyState
          headline="Sin deudas registradas — el lugar correcto en el que estar."
          body="Cuando asumas un préstamo, una hipoteca o cualquier obligación con calendario de pagos, regístrala acá. Las tarjetas de crédito viven en Tarjetas."
          action={<NewDebtTrigger />}
        />
      ) : (
        <>
          {/* Préstamos y otros */}
          {activeDebts.length > 0 && (
            <section className="flex flex-col gap-4">
              <header className="flex items-baseline justify-between">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <h2 className="text-text text-sm font-semibold">
                    Préstamos y otras deudas
                  </h2>
                  <p className="text-text-tertiary text-[12px]">
                    Saldo, cuota, plazo y avance.
                  </p>
                </div>
              </header>
              <ul className="flex flex-col gap-3">
                {activeDebts.map((d) => {
                  const meta = debtTypeMeta[d.type]
                  const Icon = icons[meta.icon]
                  const principal = Number.parseFloat(d.principal)
                  const balance = Number.parseFloat(d.currentBalance)
                  const paid = principal - balance
                  const progress =
                    principal > 0 ? Math.max(0, Math.min(1, paid / principal)) : 0
                  const days = daysUntil(d.nextPaymentDate)
                  return (
                    <li key={d.id}>
                      <article className="border-border-default bg-surface flex min-w-0 flex-col gap-5 rounded-[12px] border p-5">
                        <header className="flex flex-wrap items-start justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-3">
                            <span className="border-border-default flex h-9 w-9 items-center justify-center rounded-md border">
                              <Icon strokeWidth={1.5} className="h-4 w-4" />
                            </span>
                            <div className="flex min-w-0 flex-col">
                              <span className="text-text truncate text-sm font-semibold">
                                {d.name}
                              </span>
                              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                                {meta.label}
                                {d.lender ? ` · ${d.lender}` : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-text-tertiary text-[11px] tracking-wider">
                              {d.currency}
                            </span>
                            <DebtActionsMenu debt={d} />
                          </div>
                        </header>

                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                          <div className="flex flex-col gap-1">
                            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                              Saldo pendiente
                            </span>
                            <Amount
                              value={d.currentBalance}
                              currency={d.currency as CurrencyCode}
                              kind="neutral"
                              className="text-2xl"
                            />
                            <span className="text-text-tertiary text-[11px]">
                              de{' '}
                              {formatMoney(d.principal, {
                                currency: d.currency as CurrencyCode,
                                compact: true,
                              })}{' '}
                              original
                            </span>
                          </div>

                          {d.installmentAmount && (
                            <div className="flex flex-col gap-1">
                              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                                Cuota mensual
                              </span>
                              <Amount
                                value={d.installmentAmount}
                                currency={d.currency as CurrencyCode}
                                kind="neutral"
                                className="text-2xl"
                              />
                              {d.termMonths && (
                                <span className="text-text-tertiary text-[11px]">
                                  plazo {d.termMonths} meses
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Progress avance */}
                        {principal > 0 && (
                          <div className="flex flex-col gap-2">
                            <div className="flex items-baseline justify-between text-[12px]">
                              <span className="text-text-tertiary">
                                Avance
                              </span>
                              <span className="text-text-secondary tabular">
                                {Math.round(progress * 100)}% pagado
                              </span>
                            </div>
                            <div className="bg-surface-hover relative h-1.5 overflow-hidden rounded-full">
                              <div
                                aria-hidden
                                className="h-full rounded-full"
                                style={{
                                  width: `${progress * 100}%`,
                                  background: 'var(--brand-purple-strong)',
                                }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Footer meta */}
                        <dl className="border-border-default/60 grid grid-cols-2 gap-x-6 gap-y-2 border-t pt-4 text-[12px] sm:grid-cols-3">
                          {d.interestRate && (
                            <div className="flex flex-col gap-0.5">
                              <dt className="text-text-tertiary">Interés</dt>
                              <dd className="text-text-secondary tabular">
                                {d.interestRate}% anual
                              </dd>
                            </div>
                          )}
                          {d.nextPaymentDate && (
                            <div className="flex flex-col gap-0.5">
                              <dt className="text-text-tertiary">
                                Próximo pago
                              </dt>
                              <dd className="text-text-secondary tabular">
                                {d.nextPaymentDate}
                                {days !== null && (
                                  <>
                                    {' · '}
                                    {days < 0
                                      ? 'vencido'
                                      : days === 0
                                        ? 'hoy'
                                        : days === 1
                                          ? 'mañana'
                                          : `en ${days}d`}
                                  </>
                                )}
                              </dd>
                            </div>
                          )}
                          {d.paymentDay && (
                            <div className="flex flex-col gap-0.5">
                              <dt className="text-text-tertiary">Día corte</dt>
                              <dd className="text-text-secondary tabular">
                                {d.paymentDay} de cada mes
                              </dd>
                            </div>
                          )}
                          {d.originDate && (
                            <div className="flex flex-col gap-0.5">
                              <dt className="text-text-tertiary">Origen</dt>
                              <dd className="text-text-secondary tabular">
                                {d.originDate}
                              </dd>
                            </div>
                          )}
                        </dl>

                        {d.notes && (
                          <p className="text-text-secondary border-border-default/60 border-t pt-4 text-[13px] leading-relaxed">
                            {d.notes}
                          </p>
                        )}
                      </article>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}

          {/* Históricas (pagadas o defaulted) */}
          {archivedOrPaid.length > 0 && (
            <section className="flex flex-col gap-3">
              <header>
                <h2 className="text-text-secondary text-sm font-medium">
                  Histórico
                </h2>
              </header>
              <ul className="flex flex-col">
                {archivedOrPaid.map((d) => {
                  const meta = debtTypeMeta[d.type]
                  return (
                    <li
                      key={d.id}
                      className="border-border-default/60 flex items-center justify-between gap-3 border-b py-3 last:border-b-0"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                          {d.status === 'paid' ? 'Pagada' : 'Default'}
                        </span>
                        <span className="text-text truncate text-sm">
                          {d.name}
                        </span>
                        <span className="text-text-tertiary text-[11px]">
                          {meta.label}
                        </span>
                      </div>
                      <span className="text-text-tertiary text-[12px] tabular">
                        {formatMoney(d.principal, {
                          currency: d.currency as CurrencyCode,
                          compact: true,
                        })}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
