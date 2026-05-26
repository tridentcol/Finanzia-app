import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { EmptyState } from '@/components/app/empty-state'
import { Amount } from '@/components/app/amount'
import { NewAccountTrigger } from '@/components/app/new-account-trigger'
import { icons, type IconName } from '@/lib/design/icons'
import { formatMoney } from '@/lib/currency/format'

export const metadata: Metadata = {
  title: 'Cuentas',
}

const typeMeta: Record<
  | 'checking'
  | 'savings'
  | 'credit_card'
  | 'cash'
  | 'investment'
  | 'crypto'
  | 'other',
  { label: string; icon: IconName }
> = {
  checking: { label: 'Cuenta corriente', icon: 'landmark' },
  savings: { label: 'Ahorros', icon: 'piggy-bank' },
  credit_card: { label: 'Tarjeta', icon: 'credit-card' },
  cash: { label: 'Efectivo', icon: 'banknote' },
  investment: { label: 'Inversión', icon: 'trending-up' },
  crypto: { label: 'Cripto', icon: 'bitcoin' },
  other: { label: 'Otra', icon: 'circle' },
}

export default async function CuentasPage() {
  const user = await requireCurrentUser()
  const accountsList = await listAccountsWithBalance(user.id)

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-text-secondary text-sm">Cuentas</p>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Todas tus cuentas
          </h1>
        </div>
        <NewAccountTrigger />
      </header>

      {accountsList.length === 0 ? (
        <EmptyState
          headline="Todavía no hay cuentas registradas."
          body="Las cuentas son la base de Finanzia: corrientes, tarjetas, ahorros, inversiones. Empieza por una — siempre se pueden agregar más."
          action={<NewAccountTrigger />}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {accountsList.map((a) => {
            const meta = typeMeta[a.type]
            const Icon = icons[a.icon as IconName] ?? icons[meta.icon]
            return (
              <li key={a.id} className="min-w-0">
                <article className="border-border-default bg-surface group relative flex min-w-0 flex-col gap-5 rounded-[12px] border p-5">
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="border-border-default flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                        style={a.color ? { color: a.color } : undefined}
                      >
                        <Icon strokeWidth={1.5} className="h-4 w-4" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-text truncate text-sm font-semibold">
                          {a.name}
                        </span>
                        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                          {meta.label}
                        </span>
                      </div>
                    </div>
                    <span className="text-text-tertiary shrink-0 text-[11px] tracking-wider">
                      {a.currency}
                    </span>
                  </header>

                  <div className="flex flex-col gap-1">
                    <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                      Saldo actual
                    </span>
                    <Amount
                      value={a.currentBalance}
                      currency={a.currency}
                      kind={parseFloat(a.currentBalance) < 0 ? 'negative' : 'neutral'}
                      className="text-2xl"
                    />
                  </div>

                  {a.type === 'credit_card' && a.creditLimit && (() => {
                    const limit = parseFloat(a.creditLimit)
                    const balance = parseFloat(a.currentBalance)
                    // Para tarjetas: si balance es negativo (deuda), el utilizado = abs(balance).
                    const used = balance < 0 ? -balance : 0
                    const available = limit - used
                    const utilization = limit > 0 ? Math.min(1, used / limit) : 0
                    const tone =
                      utilization >= 0.9
                        ? 'bg-negative'
                        : utilization >= 0.6
                          ? 'bg-warning'
                          : 'bg-text'
                    const todayDay = new Date().getUTCDate()
                    const daysTo = (target: number | null): number | null => {
                      if (!target) return null
                      const diff = target - todayDay
                      return diff >= 0 ? diff : diff + 30
                    }
                    const stD = daysTo(a.statementDay)
                    const pyD = daysTo(a.paymentDay)
                    return (
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
                            {formatMoney(available, { currency: a.currency, compact: true })}
                          </dd>
                          <dt className="text-text-tertiary">Cupo</dt>
                          <dd className="text-text-secondary truncate text-right tabular">
                            {formatMoney(limit, { currency: a.currency, compact: true })}
                          </dd>
                          {a.statementDay && (
                            <>
                              <dt className="text-text-tertiary">Corte</dt>
                              <dd className="text-text-secondary truncate text-right tabular">
                                día {a.statementDay} · en {stD}d
                              </dd>
                            </>
                          )}
                          {a.paymentDay && (
                            <>
                              <dt className="text-text-tertiary">Pago</dt>
                              <dd className="text-text-secondary truncate text-right tabular">
                                día {a.paymentDay} · en {pyD}d
                              </dd>
                            </>
                          )}
                        </dl>
                      </div>
                    )
                  })()}
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
