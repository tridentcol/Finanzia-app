import { Amount } from '@/components/app/amount'
import { InfoHint } from '@/components/app/info-hint'
import type { CurrencyCode } from '@/lib/currency/currencies'

/** Celda de KPI (Próximos 30 días): número con tono + hint/info opcional. */
export function KpiCell({
  label,
  value,
  currency,
  tone,
  showSign,
  hint,
  info,
}: {
  label: string
  value: number | string
  currency?: CurrencyCode
  tone?: 'positive' | 'negative' | 'neutral'
  showSign?: boolean
  hint?: string
  info?: string
}) {
  const isNumber = typeof value === 'number'
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-text-tertiary flex items-center gap-1 text-[11px] tracking-[0.08em] uppercase">
        {label}
        {info && <InfoHint label={info} />}
      </span>
      {isNumber && currency ? (
        <Amount
          value={String(value.toFixed(2))}
          currency={currency}
          kind={tone ?? 'neutral'}
          showPositiveSign={showSign && value > 0}
          className="text-base sm:text-lg"
        />
      ) : (
        <span className="text-text amount text-base sm:text-lg">{value}</span>
      )}
      {hint && <span className="text-text-tertiary text-[11px]">{hint}</span>}
    </div>
  )
}

/** Mini-stat por horizonte (Hoy / En 30 / En 60 días) con delta opcional. */
export function HorizonStat({
  label,
  value,
  currency,
  delta,
}: {
  label: string
  value: number
  currency: CurrencyCode
  delta?: number
}) {
  return (
    <div className="flex flex-col gap-1 p-4">
      <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">{label}</span>
      <Amount
        value={String(value.toFixed(2))}
        currency={currency}
        kind={value < 0 ? 'negative' : 'neutral'}
        className="text-base sm:text-lg"
      />
      {delta !== undefined && (
        <span
          className={`font-mono text-[11px] tabular-nums ${
            delta >= 0 ? 'text-positive' : 'text-negative'
          }`}
        >
          {delta >= 0 ? '+' : ''}
          {Math.round(delta).toLocaleString('es-CO')}
        </span>
      )}
    </div>
  )
}
