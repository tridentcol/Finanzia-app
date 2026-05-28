import type { Metadata } from 'next'
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { monthlyReports } from '@/lib/db/schema'
import { EmptyState } from '@/components/app/empty-state'

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

  const reports = await db
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
    .orderBy(desc(monthlyReports.period))

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="text-text-secondary text-sm">Informes</p>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Historial mensual
        </h1>
      </header>

      {reports.length === 0 ? (
        <EmptyState
          headline="Todavía no hay informes."
          body="El primer día de cada mes Finanzia genera automáticamente un resumen con ingresos, gastos, ahorro y hábitos detectados por IA."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {reports.map((r) => {
            const savings = Number.parseFloat(r.netSavings)
            return (
              <li key={r.id}>
                <Link
                  href={`/informes/${r.period}`}
                  className="border-border-default bg-surface hover:bg-surface-hover/60 flex min-w-0 items-center gap-4 rounded-[12px] border p-5 transition-colors"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="text-text text-sm font-semibold capitalize">
                      {formatPeriod(r.period)}
                    </span>
                    {r.aiSummary && (
                      <span className="text-text-secondary line-clamp-1 text-[13px] italic">
                        {r.aiSummary}
                      </span>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    <span
                      className={`font-mono text-sm tabular ${
                        savings >= 0 ? 'text-positive' : 'text-negative'
                      }`}
                    >
                      {savings >= 0 ? '+' : ''}
                      {Number(savings).toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                    </span>
                    <span className="text-text-tertiary text-[11px]">ahorro neto</span>
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
