import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, desc, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { monthlyReports, profiles } from '@/lib/db/schema'
import { formatMoney } from '@/lib/currency/format'
import { Amount } from '@/components/app/amount'
import type { CurrencyCode } from '@/lib/currency/currencies'

type Props = { params: Promise<{ period: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { period } = await params
  return { title: `Informe ${period}` }
}

function formatPeriod(period: string): string {
  const [year, month] = period.split('-')
  if (!year || !month) return period
  return new Date(
    Date.UTC(Number(year), Number(month) - 1, 1),
  ).toLocaleDateString('es-CO', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export default async function InformePage({ params }: Props) {
  const { period } = await params

  if (!/^\d{4}-\d{2}$/.test(period)) notFound()

  const user = await requireCurrentUser()

  const [report, profile] = await Promise.all([
    db.query.monthlyReports.findFirst({
      where: and(eq(monthlyReports.userId, user.id), eq(monthlyReports.period, period)),
    }),
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
  ])

  if (!report) {
    return (
      <div className="flex min-w-0 flex-col gap-10">
        <header className="flex min-w-0 flex-col gap-2">
          <Link
            href="/informes"
            className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors"
          >
            Informes
          </Link>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl capitalize">
            {formatPeriod(period)}
          </h1>
        </header>
        <div className="border-border-default bg-surface flex flex-col gap-3 rounded-[12px] border p-8 text-center">
          <p className="editorial text-text-secondary text-base italic">
            El informe de {formatPeriod(period)} todavía no está disponible.
          </p>
          <p className="text-text-tertiary text-[13px]">
            Se genera automáticamente el primer día de cada mes.
          </p>
        </div>
      </div>
    )
  }

  const currency = (profile?.baseCurrency ?? 'COP') as CurrencyCode
  const income = Number.parseFloat(report.totalIncome)
  const expense = Number.parseFloat(report.totalExpense)
  const savings = Number.parseFloat(report.netSavings)
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex min-w-0 flex-col gap-2">
        <Link
          href="/informes"
          className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors"
        >
          Informes
        </Link>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl capitalize">
          {formatPeriod(period)}
        </h1>
        {report.aiSummary && (
          <p className="editorial text-text-secondary max-w-prose text-base italic">
            {report.aiSummary}
          </p>
        )}
      </header>

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard label="Ingresos" value={income} currency={currency} tone="positive" />
        <KpiCard label="Gastos" value={expense} currency={currency} tone="negative" />
        <KpiCard label="Ahorro neto" value={savings} currency={currency} tone={savings >= 0 ? 'positive' : 'negative'} />
        <div className="border-border-default bg-surface flex flex-col gap-1 rounded-[12px] border p-4">
          <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Tasa de ahorro
          </span>
          <span
            className={`font-mono text-2xl font-semibold tabular ${
              savingsRate >= 20 ? 'text-positive' : savingsRate >= 5 ? 'text-text' : 'text-negative'
            }`}
          >
            {savingsRate}%
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        {/* Top categorías */}
        {report.topCategories.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-text text-sm font-semibold">Top categorías de gasto</h2>
            <ul className="border-border-default bg-surface flex flex-col divide-y divide-[color:var(--border-default)] rounded-[12px] border">
              {report.topCategories.map((c, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-text-secondary truncate text-[13px]">{c.name}</span>
                  <span className="text-text-secondary font-mono text-[13px] tabular">
                    {formatMoney(Number.parseFloat(c.amount), { currency, compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Top merchants */}
        {report.topMerchants.length > 0 && (
          <section className="flex flex-col gap-4">
            <h2 className="text-text text-sm font-semibold">Top comercios</h2>
            <ul className="border-border-default bg-surface flex flex-col divide-y divide-[color:var(--border-default)] rounded-[12px] border">
              {report.topMerchants.map((m, i) => (
                <li key={i} className="flex items-center justify-between gap-4 px-4 py-3">
                  <span className="text-text-secondary truncate text-[13px]">{m.name}</span>
                  <span className="text-text-secondary font-mono text-[13px] tabular">
                    {formatMoney(Number.parseFloat(m.amount), { currency, compact: true })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {/* AI habits */}
      {report.aiHabits.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-text text-sm font-semibold">Hábitos detectados</h2>
          <ul className="flex flex-col gap-3">
            {report.aiHabits.map((h, i) => (
              <li
                key={i}
                className="border-border-default bg-surface flex flex-col gap-1 rounded-[12px] border p-4"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      h.kind === 'positive'
                        ? 'bg-positive'
                        : h.kind === 'negative'
                          ? 'bg-negative'
                          : 'bg-text-tertiary'
                    }`}
                  />
                  <span className="text-text text-[13px] font-semibold">{h.title}</span>
                </div>
                <p className="text-text-secondary text-[13px]">{h.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="text-text-tertiary text-[11px]">
        Generado el{' '}
        {new Date(report.generatedAt).toLocaleDateString('es-CO', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })}
      </footer>
    </div>
  )
}

function KpiCard({
  label,
  value,
  currency,
  tone,
}: {
  label: string
  value: number
  currency: CurrencyCode
  tone: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <div className="border-border-default bg-surface flex flex-col gap-1 rounded-[12px] border p-4">
      <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">{label}</span>
      <Amount
        value={String(Math.abs(value).toFixed(2))}
        currency={currency}
        kind={tone}
        showPositiveSign={tone === 'positive'}
        className="text-2xl"
      />
    </div>
  )
}
