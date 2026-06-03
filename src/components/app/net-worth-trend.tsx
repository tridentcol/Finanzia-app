'use client'

import { useTransition } from 'react'
import dynamic from 'next/dynamic'

import { Skeleton } from '@/components/ui/skeleton'
import { Amount } from '@/components/app/amount'
import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import type { NetWorthPoint, NetWorthNow } from '@/lib/db/queries/net-worth'
import { runNetWorthBackfillNow } from '@/app/(app)/mi-dinero/cash-flow/actions'
import { cn } from '@/lib/utils'

const NetWorthChart = dynamic(() => import('./net-worth-chart').then((m) => m.NetWorthChart), {
  ssr: false,
  loading: () => <Skeleton className="h-52 w-full rounded-[12px]" />,
})

function monthLabel(iso: string): string {
  return new Date(iso + 'T12:00:00Z').toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

/**
 * Sección "Patrimonio en el tiempo": tendencia del neto + composición actual.
 * Si aún no hay histórico, ofrece reconstruirlo desde el ledger. Noir, editorial.
 */
export function NetWorthTrend({
  points,
  now,
  baseCurrency,
}: {
  points: NetWorthPoint[]
  now: NetWorthNow
  baseCurrency: CurrencyCode
}) {
  const [pending, startTransition] = useTransition()

  function backfill() {
    startTransition(async () => {
      await runNetWorthBackfillNow()
    })
  }

  const hasHistory = points.length >= 2

  return (
    <section className="flex min-w-0 flex-col gap-4">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-text text-sm font-semibold">Patrimonio en el tiempo</h2>
        {hasHistory && (
          <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
            Desde {monthLabel(points[0]!.date)}
          </span>
        )}
      </header>

      {hasHistory ? (
        <>
          <div className="border-border-default bg-surface rounded-[12px] border px-5 py-6">
            <NetWorthChart points={points.map((p) => ({ date: p.date, net: p.net }))} />
          </div>
          <TrendSummary points={points} baseCurrency={baseCurrency} />
          <Composition now={now} baseCurrency={baseCurrency} />
        </>
      ) : (
        <div className="border-border-default bg-surface flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-5">
          <p className="text-text-secondary max-w-prose text-[13px]">
            Reconstruimos la trayectoria de tu patrimonio desde tu historial de movimientos para ver
            cómo evolucionó mes a mes.
          </p>
          <button
            type="button"
            onClick={backfill}
            disabled={pending}
            className="border-border-default hover:bg-surface-hover text-text-secondary hover:text-text shrink-0 rounded-[8px] border px-3 py-1.5 text-[13px] transition-colors disabled:opacity-50"
          >
            {pending ? 'Reconstruyendo…' : 'Reconstruir historial'}
          </button>
        </div>
      )}
    </section>
  )
}

function TrendSummary({
  points,
  baseCurrency,
}: {
  points: NetWorthPoint[]
  baseCurrency: CurrencyCode
}) {
  const first = points[0]!
  const last = points[points.length - 1]!
  const delta = last.net - first.net
  const up = delta >= 0

  return (
    <p className="text-text-tertiary text-xs">
      Tu patrimonio {up ? 'subió' : 'bajó'}{' '}
      <span className={up ? 'text-positive' : 'text-negative'}>
        {up ? '+' : '−'}
        {formatMoney(Math.abs(delta), { currency: baseCurrency, compact: true })}
      </span>{' '}
      desde {monthLabel(first.date)}.
    </p>
  )
}

function Composition({ now, baseCurrency }: { now: NetWorthNow; baseCurrency: CurrencyCode }) {
  const total = now.assets + now.debts
  const assetsPct = total > 0 ? (now.assets / total) * 100 : 100

  return (
    <div className="border-border-default bg-surface flex flex-col gap-3 rounded-[12px] border p-5">
      <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
        Composición hoy
      </span>
      {/* Barra activos vs deudas */}
      <div className="bg-surface-hover flex h-2 w-full overflow-hidden rounded-full">
        <div
          className="bg-positive h-full"
          style={{ width: `${Math.max(0, Math.min(100, assetsPct))}%` }}
        />
        <div className="bg-negative h-full flex-1" />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <CompRow label="Activos" value={now.assets} tone="positive" currency={baseCurrency} />
        <CompRow label="Deudas" value={now.debts} tone="negative" currency={baseCurrency} />
      </div>
    </div>
  )
}

function CompRow({
  label,
  value,
  tone,
  currency,
}: {
  label: string
  value: number
  tone: 'positive' | 'negative'
  currency: CurrencyCode
}) {
  return (
    <div className="flex items-center gap-2 text-[13px]">
      <span
        aria-hidden
        className={cn('size-2 rounded-full', tone === 'positive' ? 'bg-positive' : 'bg-negative')}
      />
      <span className="text-text-secondary">{label}</span>
      <Amount
        value={value.toFixed(2)}
        currency={currency}
        compact
        className="text-text text-[13px]"
      />
    </div>
  )
}
