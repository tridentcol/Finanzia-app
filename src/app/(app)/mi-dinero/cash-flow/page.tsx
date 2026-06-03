import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import { getCashFlowData } from '@/lib/db/queries/cash-flow'
import { getNetWorthSeries } from '@/lib/db/queries/net-worth'
import { getMetasData } from '@/lib/db/queries/goals'
import { NetWorthTrend } from '@/components/app/net-worth-trend'
import { Amount } from '@/components/app/amount'
import { InfoHint } from '@/components/app/info-hint'
import { formatMoney } from '@/lib/currency/format'
import type { WhatIfGoal } from '@/components/app/what-if-panel'
import type { CurrencyCode } from '@/lib/currency/currencies'

import { CashFlowProjection } from './cash-flow-projection'

export const metadata: Metadata = {
  title: 'Cash flow',
}

export default async function CashFlowPage() {
  const user = await requireCurrentUser()

  const profile = await getProfile(user.id)
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode
  const today = new Date().toISOString().slice(0, 10)

  const { rules, creditCards, volatility, assetsBase, assetsPartial, debtsSummary, ccRatesObj } =
    await getCashFlowData(user.id, baseCurrency, today)

  // ── Patrimonio neto ──────────────────────────────────────────────
  // Activos = cuentas no-crédito en base. Pasivos = deuda en tarjetas +
  // préstamos/hipotecas activas.
  const ccRates = new Map(Object.entries(ccRatesObj))
  let ccDebtBase = 0
  let ccPartial = false
  for (const c of creditCards) {
    const balance = Number.parseFloat(c.currentBalance)
    if (balance >= 0) continue
    const used = -balance
    if (c.currency === baseCurrency) {
      ccDebtBase += used
      continue
    }
    const rate = ccRates.get(`${c.currency}->${baseCurrency}`)
    if (!rate) {
      ccPartial = true
      ccDebtBase += used
      continue
    }
    ccDebtBase += used * Number.parseFloat(rate)
  }

  const assets = Number.parseFloat(assetsBase)
  const debts = Number.parseFloat(debtsSummary.totalBalanceInBase)
  const netWorth = assets - ccDebtBase - debts
  const netWorthPartial = assetsPartial || ccPartial || debtsSummary.partial

  // Patrimonio en el tiempo: snapshots persistidos + punto vivo de hoy.
  const { points: netWorthPoints, now: netWorthNow } = await getNetWorthSeries(
    user.id,
    baseCurrency,
    today,
  )

  // Metas activas con saldo restante para el simulador what-if.
  const goals = await getMetasData(user.id, today)
  const whatIfGoals: WhatIfGoal[] = goals
    .filter((g) => g.status === 'active')
    .map((g) => ({
      id: g.id,
      name: g.name,
      remaining: Math.max(
        0,
        Number.parseFloat(g.targetAmount) - Number.parseFloat(g.currentAmount),
      ),
      currency: g.currency as CurrencyCode,
      daysToTarget: g.daysToTarget,
    }))
    .filter((g) => g.remaining > 0)

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      {/* Hero — patrimonio neto */}
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary flex items-center gap-1.5 text-sm">
          Patrimonio neto
          <InfoHint
            side="right"
            label="Suma de tus activos (cuentas + inversiones) menos las deudas que mantienes — tarjetas con saldo y préstamos. Es la foto de cuánto realmente te pertenece hoy."
          />
        </p>
        <Amount
          value={netWorth.toFixed(2)}
          currency={baseCurrency}
          display
          kind={netWorth < 0 ? 'negative' : 'neutral'}
          className="block truncate text-[28px] sm:text-4xl md:text-5xl"
        />
        <p className="text-text-tertiary text-xs">
          activos {formatMoney(assets, { currency: baseCurrency, compact: true })} − tarjetas{' '}
          {formatMoney(ccDebtBase, { currency: baseCurrency, compact: true })} − deudas{' '}
          {formatMoney(debts, { currency: baseCurrency, compact: true })}
          {netWorthPartial && ' · conversión parcial'}
        </p>
      </header>

      {/* Patrimonio en el tiempo — tendencia del neto + composición actual. */}
      <NetWorthTrend points={netWorthPoints} now={netWorthNow} baseCurrency={baseCurrency} />

      {/* Proyección, what-if y breakdowns (decide empty-state vs contenido). */}
      <CashFlowProjection
        rules={rules}
        startingBalance={assets}
        volatility={volatility}
        goals={whatIfGoals}
        baseCurrency={baseCurrency}
      />
    </div>
  )
}
