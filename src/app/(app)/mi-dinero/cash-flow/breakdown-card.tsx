import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import type { Breakdown } from './breakdown'

/** Tarjeta de breakdown (ingresos/gastos recurrentes) con barras por categoría. */
export function BreakdownCard({
  title,
  breakdown,
  currency,
  tone,
  emptyHint,
}: {
  title: string
  breakdown: Breakdown
  currency: CurrencyCode
  tone: 'positive' | 'brand'
  emptyHint: string | null
}) {
  const barColor = tone === 'positive' ? 'var(--positive)' : 'var(--purple-base)'

  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-text text-sm font-semibold">{title}</h2>
        <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
          Equiv. mensual
        </span>
      </header>
      <div className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-5">
        {breakdown.entries.length === 0 && emptyHint ? (
          <p className="text-text-tertiary text-[12px]">{emptyHint}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {breakdown.entries.map((c) => {
              const widthPct = Math.max(2, (c.total / breakdown.max) * 100)
              const sharePct = breakdown.sum > 0 ? Math.round((c.total / breakdown.sum) * 100) : 0
              return (
                <li key={c.label} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-text truncate text-[13px]">{c.label}</span>
                    <span className="text-text-secondary tabular shrink-0 text-[12px]">
                      {formatMoney(c.total, { currency, compact: true })}
                      <span className="text-text-tertiary ml-2 text-[11px]">{sharePct}%</span>
                    </span>
                  </div>
                  <div className="bg-surface-hover h-1 overflow-hidden rounded-full">
                    <div
                      aria-hidden
                      className="h-full rounded-full"
                      style={{ width: `${widthPct}%`, background: barColor }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        )}
        {breakdown.entries.length > 0 && (
          <p className="text-text-tertiary text-[11px]">
            Total mensual:{' '}
            <span className="text-text-secondary tabular">
              {formatMoney(breakdown.sum, { currency, compact: true })}
            </span>
          </p>
        )}
      </div>
    </section>
  )
}
