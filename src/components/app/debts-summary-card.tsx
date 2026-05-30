import Link from 'next/link'

import { Amount } from '@/components/app/amount'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import type { DebtsSummary } from '@/lib/db/queries/debts'

type Props = {
  summary: DebtsSummary
  /** Deuda total de tarjetas (en base currency, sumada aparte). */
  creditCardDebtInBase: number
  currency: CurrencyCode
}

function daysUntilLabel(dateIso: string): string {
  const target = new Date(`${dateIso}T00:00:00`)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round(
    (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  )
  if (diff < 0) return 'vencido'
  if (diff === 0) return 'hoy'
  if (diff === 1) return 'mañana'
  return `en ${diff} días`
}

/**
 * Widget de deuda para el dashboard. Patrón visual idéntico al resto:
 * header con título + link "Ver detalle", contenido en card `bg-surface`
 * con `border`. Sin fondos tintados, sin iconos en cajita, sin links
 * duplicados — armonía Noir con el resto de widgets de Hoy.
 */
export function DebtsSummaryCard({
  summary,
  creditCardDebtInBase,
  currency,
}: Props) {
  const debtsTotal = Number.parseFloat(summary.totalBalanceInBase)
  const grandTotal = debtsTotal + creditCardDebtInBase

  if (grandTotal <= 0 && summary.activeCount === 0) return null

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-text text-sm font-semibold">Tu deuda</h2>
        <Link
          href="/mi-dinero/deudas"
          className="text-text-secondary hover:text-text text-[13px] transition-colors"
        >
          Ver detalle
        </Link>
      </header>

      <article className="border-border-default bg-surface flex flex-col rounded-[12px] border">
        {/* Total */}
        <div className="flex items-end justify-between gap-4 px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Saldo total adeudado
            </span>
            <Amount
              value={grandTotal.toFixed(2)}
              currency={currency}
              kind="neutral"
              className="text-xl"
            />
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 text-[11px]">
            {creditCardDebtInBase > 0 && (
              <span className="text-text-tertiary tabular">
                <span className="amount">
                  {formatMoney(creditCardDebtInBase, { currency, compact: true })}
                </span>{' '}
                en tarjetas
              </span>
            )}
            {summary.activeCount > 0 && (
              <span className="text-text-tertiary tabular">
                <span className="amount">
                  {formatMoney(debtsTotal, { currency, compact: true })}
                </span>{' '}
                en {summary.activeCount}{' '}
                {summary.activeCount === 1 ? 'préstamo' : 'préstamos'}
              </span>
            )}
            {summary.partial && (
              <span className="text-text-tertiary">conversión parcial</span>
            )}
          </div>
        </div>

        {summary.nextPayment && (
          <div className="border-border-default/60 flex items-end justify-between gap-4 border-t px-5 py-4">
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                Próximo pago
              </span>
              <span className="text-text truncate text-sm">
                {summary.nextPayment.debtName}
              </span>
              <span className="text-text-tertiary text-[11px]">
                {summary.nextPayment.date} · {daysUntilLabel(summary.nextPayment.date)}
              </span>
            </div>
            {summary.nextPayment.amount && (
              <Amount
                value={summary.nextPayment.amount}
                currency={summary.nextPayment.currency as CurrencyCode}
                kind="neutral"
                className="shrink-0 text-sm"
              />
            )}
          </div>
        )}
      </article>
    </section>
  )
}
