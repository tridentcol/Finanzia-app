import type { Metadata } from 'next'
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { monthlyReports, profiles } from '@/lib/db/schema'
import { EmptyState } from '@/components/app/empty-state'
import { Amount } from '@/components/app/amount'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Informes',
}

function formatPeriod(period: string): string {
  const parts = period.split('-')
  const year = parts[0]
  const month = parts[1]
  if (!year || !month) return period
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, 1),
  ).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export default async function InformesPage() {
  const user = await requireCurrentUser()

  const [reports, profile] = await Promise.all([
    db
      .select({
        id: monthlyReports.id,
        period: monthlyReports.period,
        totalIncome: monthlyReports.totalIncome,
        totalExpense: monthlyReports.totalExpense,
        netSavings: monthlyReports.netSavings,
        aiSummary: monthlyReports.aiSummary,
      })
      .from(monthlyReports)
      .where(eq(monthlyReports.userId, user.id))
      .orderBy(desc(monthlyReports.period)),
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
  ])

  const currency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="text-text-secondary text-sm">Informes</p>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Tu historia, mes a mes
        </h1>
      </header>

      {reports.length === 0 ? (
        <EmptyState
          headline="Todavía no hay informes."
          body="El primer día de cada mes Finanzia cierra el mes anterior y genera un resumen con ingresos, gastos, ahorro y hábitos detectados por IA."
        />
      ) : (
        <ul className="flex flex-col">
          {reports.map((r, i) => {
            const savings = Number.parseFloat(r.netSavings)
            return (
              <li key={r.id}>
                <Link
                  href={`/informes/${r.period}`}
                  className={`group flex min-w-0 items-center gap-6 py-5 transition-colors hover:bg-surface-hover/30 -mx-2 px-2 rounded-[8px] ${
                    i !== reports.length - 1 ? 'border-border-default/60 border-b' : ''
                  }`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="editorial text-text text-lg italic capitalize sm:text-xl">
                      {formatPeriod(r.period)}
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
      )}
    </div>
  )
}
