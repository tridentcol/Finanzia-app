import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import { getInformesData } from '@/lib/db/queries/reports'
import { EmptyState } from '@/components/app/empty-state'
import { Amount } from '@/components/app/amount'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Informes',
}

const MONTH_LABELS: Record<string, string> = {
  '01': 'Enero',
  '02': 'Febrero',
  '03': 'Marzo',
  '04': 'Abril',
  '05': 'Mayo',
  '06': 'Junio',
  '07': 'Julio',
  '08': 'Agosto',
  '09': 'Septiembre',
  '10': 'Octubre',
  '11': 'Noviembre',
  '12': 'Diciembre',
}

function monthLabel(period: string): string {
  const [, month] = period.split('-')
  return MONTH_LABELS[month ?? ''] ?? period
}

function yearOf(period: string): string {
  return period.split('-')[0] ?? ''
}

export default async function InformesPage() {
  const user = await requireCurrentUser()

  const [reports, profile] = await Promise.all([
    getInformesData(user.id),
    getProfile(user.id),
  ])

  const currency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  // Agrupar por año para el timeline.
  const groups = new Map<string, typeof reports>()
  for (const r of reports) {
    const y = yearOf(r.period)
    const arr = groups.get(y) ?? []
    arr.push(r)
    groups.set(y, arr)
  }
  const orderedYears = Array.from(groups.entries()).sort(([a], [b]) =>
    b.localeCompare(a),
  )

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary text-sm">Informes</p>
        <h1 className="editorial text-text text-3xl italic tracking-tight sm:text-4xl">
          Tu historia, mes a mes
        </h1>
        <p className="text-text-tertiary mt-1 max-w-prose text-[13px]">
          El primero de cada mes Finanzia cierra el anterior: ingresos, gastos,
          ahorro y hábitos detectados.
        </p>
      </header>

      {reports.length === 0 ? (
        <EmptyState
          headline="Todavía no hay informes."
          body="El primer día de cada mes Finanzia cierra el mes anterior y genera un resumen con ingresos, gastos, ahorro y hábitos detectados por IA."
        />
      ) : (
        <div className="flex flex-col gap-10 lg:gap-12">
          {orderedYears.map(([year, items]) => (
            <section key={year} className="flex min-w-0 flex-col gap-4">
              <header className="border-border-default/60 flex items-baseline justify-between border-b pb-2">
                <h2 className="text-text-tertiary font-mono text-[11px] uppercase tracking-[0.12em]">
                  {year}
                </h2>
                <span className="text-text-tertiary text-[11px] tabular">
                  {items.length} {items.length === 1 ? 'mes' : 'meses'}
                </span>
              </header>
              <ul className="flex flex-col">
                {items.map((r, i) => {
                  const savings = Number.parseFloat(r.netSavings)
                  return (
                    <li key={r.id}>
                      <Link
                        href={`/mi-historia/informes/${r.period}`}
                        className={`group -mx-2 flex min-w-0 items-center gap-6 rounded-[8px] px-2 py-5 transition-colors hover:bg-surface-hover/30 ${
                          i !== items.length - 1
                            ? 'border-border-default/60 border-b'
                            : ''
                        }`}
                      >
                        <div className="flex min-w-0 flex-1 flex-col gap-1">
                          <span className="editorial text-text text-lg italic capitalize sm:text-xl">
                            {monthLabel(r.period)}
                          </span>
                          {r.aiSummary && (
                            <span className="text-text-secondary line-clamp-1 text-[13px]">
                              {r.aiSummary}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-0.5">
                          <Amount
                            value={String(Math.abs(savings).toFixed(2))}
                            currency={currency}
                            kind={savings >= 0 ? 'positive' : 'negative'}
                            showPositiveSign={savings >= 0}
                            className="text-base"
                          />
                          <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                            Ahorro neto
                          </span>
                        </div>
                      </Link>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
