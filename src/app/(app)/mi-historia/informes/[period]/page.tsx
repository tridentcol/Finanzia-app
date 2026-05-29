import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { monthlyReports, profiles } from '@/lib/db/schema'
import { getExpensesByParentCategory } from '@/lib/db/queries/expenses-by-parent'
import { listInsightsForUser } from '@/lib/db/queries/insights'
import { formatMoney } from '@/lib/currency/format'
import { Amount } from '@/components/app/amount'
import { CategoryBreakdown } from '@/components/app/category-breakdown'
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

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })
  const currency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const [report, expensesByParent, monthInsights] = await Promise.all([
    db.query.monthlyReports.findFirst({
      where: and(eq(monthlyReports.userId, user.id), eq(monthlyReports.period, period)),
    }),
    getExpensesByParentCategory(user.id, currency, { month: period }),
    listInsightsForUser(user.id, { includeDismissed: false, limit: 50 }),
  ])

  // Filter insights by month — their periodEnd cae dentro de este `period`.
  const insightsOfMonth = monthInsights.filter((ins) => {
    const bucket = (ins.periodEnd ?? ins.createdAt.toISOString().slice(0, 10)).slice(0, 7)
    return bucket === period
  })

  if (!report) {
    return (
      <div className="flex min-w-0 flex-col gap-10">
        <header className="flex min-w-0 flex-col gap-1.5">
          <Link
            href="/mi-historia/informes"
            className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
          >
            ← Informes
          </Link>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl capitalize">
            {formatPeriod(period)}
          </h1>
        </header>
        <div className="flex flex-col items-start gap-2 py-12">
          <p className="editorial text-text text-xl italic sm:text-2xl">
            El informe de {formatPeriod(period)} todavía no está disponible.
          </p>
          <p className="text-text-tertiary text-sm max-w-prose">
            Se genera automáticamente el primer día de cada mes.
          </p>
        </div>
      </div>
    )
  }

  const income = Number.parseFloat(report.totalIncome)
  const expense = Number.parseFloat(report.totalExpense)
  const savings = Number.parseFloat(report.netSavings)
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0

  // Categorías y comercios: percent of expense para barras editoriales.
  const topExpense = Math.max(
    1,
    ...report.topCategories.map((c) => Number.parseFloat(c.amount)),
    ...report.topMerchants.map((m) => Number.parseFloat(m.amount)),
  )

  return (
    <div className="flex min-w-0 flex-col gap-12 lg:gap-16">
      {/* Hero editorial */}
      <header className="flex min-w-0 flex-col gap-3">
        <Link
          href="/mi-historia/informes"
          className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
        >
          ← Informes
        </Link>
        <div className="flex flex-col gap-1">
          <p className="text-text-secondary text-sm">Tu mes en</p>
          <h1 className="editorial text-text text-3xl italic tracking-tight sm:text-4xl md:text-5xl capitalize">
            {formatPeriod(period)}
          </h1>
        </div>
        {report.aiSummary && (
          <p className="text-text-secondary max-w-[60ch] text-[15px] leading-relaxed">
            {report.aiSummary}
          </p>
        )}
      </header>

      {/* Métrica héroe — ahorro neto */}
      <section className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Ahorro neto
        </p>
        <Amount
          value={String(Math.abs(savings).toFixed(2))}
          currency={currency}
          display
          kind={savings >= 0 ? 'positive' : 'negative'}
          showPositiveSign={savings >= 0}
          className="block truncate text-[32px] sm:text-5xl md:text-6xl lg:text-7xl"
        />
        <p className="text-text-tertiary text-xs">
          {savingsRate >= 0 ? `${savingsRate}% de tu ingreso del mes` : 'Ingreso insuficiente para calcular tasa'}
        </p>
      </section>

      {/* Ingresos vs Gastos — comparativa editorial */}
      <section className="grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-border-default bg-border-default sm:grid-cols-2">
        <div className="bg-surface flex flex-col gap-1.5 p-5">
          <p className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Ingresos
          </p>
          <Amount
            value={String(income.toFixed(2))}
            currency={currency}
            kind="positive"
            className="text-2xl sm:text-3xl"
          />
        </div>
        <div className="bg-surface flex flex-col gap-1.5 p-5">
          <p className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Gastos
          </p>
          <Amount
            value={String(expense.toFixed(2))}
            currency={currency}
            kind="negative"
            className="text-2xl sm:text-3xl"
          />
        </div>
      </section>

      {/* Breakdown por categoría con tonos morados — migrado desde dashboard */}
      <CategoryBreakdown data={expensesByParent} currency={currency} />

      {/* Top categorías — barras editoriales */}
      {report.topCategories.length > 0 && (
        <section className="flex flex-col gap-5">
          <header className="flex items-baseline justify-between">
            <h2 className="text-text text-sm font-semibold">Dónde se fue tu dinero</h2>
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Por categoría
            </span>
          </header>
          <ul className="flex flex-col gap-4">
            {report.topCategories.map((c, i) => {
              const amount = Number.parseFloat(c.amount)
              const width = Math.max(2, (amount / topExpense) * 100)
              return (
                <li key={i} className="flex flex-col gap-1.5">
                  <div className="flex items-baseline justify-between gap-4">
                    <span className="text-text truncate text-sm">{c.name}</span>
                    <span className="text-text-secondary shrink-0 font-mono text-sm tabular-nums">
                      {formatMoney(amount, { currency, compact: true })}
                    </span>
                  </div>
                  <div className="bg-surface h-[2px] w-full overflow-hidden rounded-full">
                    <div
                      aria-hidden
                      className="bg-text-secondary h-full rounded-full"
                      style={{ width: `${width}%` }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {/* Top comercios — lista editorial */}
      {report.topMerchants.length > 0 && (
        <section className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between">
            <h2 className="text-text text-sm font-semibold">Comercios más visitados</h2>
          </header>
          <ul className="border-border-default bg-surface flex flex-col rounded-[12px] border">
            {report.topMerchants.map((m, i) => (
              <li
                key={i}
                className={`flex items-center justify-between gap-4 px-5 py-3.5 ${
                  i !== report.topMerchants.length - 1 ? 'border-border-default/60 border-b' : ''
                }`}
              >
                <span className="text-text truncate text-sm">{m.name}</span>
                <span className="text-text-secondary shrink-0 font-mono text-sm tabular-nums">
                  {formatMoney(Number.parseFloat(m.amount), { currency, compact: true })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Hábitos detectados — editorial */}
      {report.aiHabits.length > 0 && (
        <section className="flex flex-col gap-5">
          <header className="flex items-baseline justify-between">
            <h2 className="text-text text-sm font-semibold">Hábitos del mes</h2>
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Lectura IA
            </span>
          </header>
          <ul className="flex flex-col">
            {report.aiHabits.map((h, i) => (
              <li
                key={i}
                className="border-border-default/60 flex gap-5 border-b py-5 first:pt-0 last:border-b-0 last:pb-0"
              >
                <span className="text-text-tertiary shrink-0 font-mono text-[11px] tabular-nums tracking-wider w-6">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-text text-sm font-semibold">
                    <span
                      className={`mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle ${
                        h.kind === 'positive'
                          ? 'bg-positive'
                          : h.kind === 'negative'
                            ? 'bg-negative'
                            : 'bg-text-tertiary'
                      }`}
                      aria-hidden
                    />
                    {h.title}
                  </h3>
                  <p className="text-text-secondary text-[13px] leading-relaxed">{h.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Insights del mismo mes — cross-link */}
      {insightsOfMonth.length > 0 && (
        <section className="flex flex-col gap-4">
          <header className="flex items-baseline justify-between">
            <h2 className="text-text text-sm font-semibold">Lecturas de este mes</h2>
            <Link
              href={`/mi-historia/insights`}
              className="text-text-secondary hover:text-text text-[13px] transition-colors"
            >
              Ver todas
            </Link>
          </header>
          <ul className="border-border-default bg-surface flex flex-col rounded-[12px] border">
            {insightsOfMonth.slice(0, 8).map((ins, i) => (
              <li
                key={ins.id}
                className={`flex flex-col gap-1 px-5 py-3 ${
                  i !== Math.min(insightsOfMonth.length, 8) - 1
                    ? 'border-border-default/60 border-b'
                    : ''
                }`}
              >
                <span className="text-text text-sm">{ins.title}</span>
                <span className="text-text-tertiary line-clamp-2 text-[12px]">
                  {ins.body}
                </span>
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
