'use client'

import { useState } from 'react'

import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'
import { cn } from '@/lib/utils'

export type WhatIfGoal = {
  id: string
  name: string
  /** Monto restante para completar la meta (targetAmount − currentAmount), en su moneda. */
  remaining: number
  currency: CurrencyCode
  /** Días hasta la fecha objetivo del usuario (null si la meta no tiene fecha). */
  daysToTarget: number | null
}

/**
 * Simulador de escenarios multi-palanca. El usuario combina tres palancas
 * —recortar gasto, sumar ingreso y un movimiento único— y ve al instante,
 * client-side: el saldo proyectado a 90 días, el runway (cuánto dura su dinero,
 * que puede volverse sostenible), y el impacto sobre TODAS sus metas a la vez.
 * Modelo lineal honesto sobre la proyección y los recurrentes ya existentes.
 */
export function WhatIfPanel({
  startingBalance,
  monthlyIncome,
  monthlyExpense,
  balance90,
  goals,
  maxCut,
  maxIncome,
  maxOneOff,
  baseCurrency,
}: {
  startingBalance: number
  monthlyIncome: number
  monthlyExpense: number
  balance90: number
  goals: WhatIfGoal[]
  maxCut: number
  maxIncome: number
  maxOneOff: number
  baseCurrency: CurrencyCode
}) {
  const [cut, setCut] = useState(0)
  const [extraIncome, setExtraIncome] = useState(0)
  const [oneOff, setOneOff] = useState(0)

  const fmt = (v: number) => formatMoney(v, { currency: baseCurrency, compact: true })

  // Palanca mensual: lo que liberás (recorte) + lo que sumás (ingreso).
  const monthlySurplus = cut + extraIncome
  const baselineNet = monthlyIncome - monthlyExpense
  const scenarioNet = baselineNet + monthlySurplus

  const scenario90 = balance90 + monthlySurplus * 3 + oneOff
  const delta90 = scenario90 - balance90

  const runwayMonths = (net: number, bal: number): number => (net >= 0 ? Infinity : bal / -net)
  const scenarioRunway = runwayMonths(scenarioNet, startingBalance + oneOff)
  const baselineRunway = runwayMonths(baselineNet, startingBalance)

  const touched = cut > 0 || extraIncome > 0 || oneOff !== 0
  const totalRemaining = goals.reduce((acc, g) => acc + g.remaining, 0)

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-text text-sm font-semibold">Escenarios</h2>
        <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
          ¿Y si cambias algo?
        </span>
      </header>

      <div className="border-border-default bg-surface flex flex-col gap-6 rounded-[12px] border p-5 lg:p-6">
        {/* Palancas */}
        <div className="flex flex-col gap-5">
          <Lever
            label="Recortar gasto al mes"
            value={cut}
            min={0}
            max={maxCut}
            onChange={setCut}
            fmt={fmt}
          />
          <Lever
            label="Ingreso extra al mes"
            value={extraIncome}
            min={0}
            max={maxIncome}
            onChange={setExtraIncome}
            fmt={fmt}
          />
          <Lever
            label="Movimiento único"
            hint="una compra grande (−) o un ingreso puntual (+)"
            value={oneOff}
            min={-maxOneOff}
            max={maxOneOff}
            onChange={setOneOff}
            fmt={fmt}
            signed
          />
        </div>

        {!touched ? (
          <p className="text-text-tertiary editorial border-border-default/60 border-t pt-5 text-[15px] italic">
            Mové las palancas para ver el efecto sobre tu saldo, tu runway y tus metas.
          </p>
        ) : (
          <div className="border-border-default/60 flex flex-col gap-5 border-t pt-5">
            {/* Saldo + runway lado a lado */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Result
                label="Saldo a 90 días"
                value={fmt(scenario90)}
                foot={
                  <span className={delta90 >= 0 ? 'text-positive' : 'text-negative'}>
                    {delta90 >= 0 ? '+' : '−'}
                    {fmt(Math.abs(delta90))} vs tu proyección
                  </span>
                }
              />
              <Result
                label="Runway"
                value={
                  scenarioRunway === Infinity
                    ? 'Sostenible'
                    : `~${Math.max(0, Math.round(scenarioRunway))} ${
                        Math.round(scenarioRunway) === 1 ? 'mes' : 'meses'
                      }`
                }
                tone={scenarioRunway === Infinity ? 'positive' : undefined}
                foot={<RunwayFoot baseline={baselineRunway} scenario={scenarioRunway} />}
              />
            </div>

            {/* Multi-meta */}
            {goals.length > 0 && monthlySurplus > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
                  Tus metas con este ritmo de ahorro
                </span>
                <ul className="flex flex-col gap-3">
                  {goals.map((g) => (
                    <GoalRow key={g.id} goal={g} surplus={monthlySurplus} />
                  ))}
                </ul>
                {goals.length > 1 && (
                  <p className="text-text-tertiary border-border-default/60 border-t pt-3 text-[12px]">
                    Todas tus metas ({fmt(totalRemaining)}) en{' '}
                    <span className="text-text-secondary tabular">
                      ~{Math.max(1, Math.round(totalRemaining / monthlySurplus))} meses
                    </span>{' '}
                    si diriges ahí todo el ahorro.
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function Lever({
  label,
  hint,
  value,
  min,
  max,
  onChange,
  fmt,
  signed,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  onChange: (v: number) => void
  fmt: (v: number) => string
  signed?: boolean
}) {
  const range = max - min
  const step = Math.max(10_000, Math.round(range / 40 / 10_000) * 10_000)
  const display =
    signed && value > 0 ? `+${fmt(value)}` : signed && value < 0 ? `−${fmt(-value)}` : fmt(value)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-text-secondary text-[13px]">{label}</span>
        <span
          className={cn(
            'text-text amount text-lg',
            signed && value > 0 && 'text-positive',
            signed && value < 0 && 'text-negative',
          )}
        >
          {display}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
        className="w-full"
        style={{ accentColor: 'var(--text-secondary)' }}
      />
      {hint && <p className="text-text-tertiary text-[11px]">{hint}</p>}
    </div>
  )
}

function Result({
  label,
  value,
  foot,
  tone,
}: {
  label: string
  value: string
  foot: React.ReactNode
  tone?: 'positive'
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">{label}</span>
      <span className={cn('amount text-2xl', tone === 'positive' ? 'text-positive' : 'text-text')}>
        {value}
      </span>
      <span className="tabular text-[12px]">{foot}</span>
    </div>
  )
}

function RunwayFoot({ baseline, scenario }: { baseline: number; scenario: number }) {
  if (scenario === Infinity) {
    return <span className="text-positive">tu saldo deja de bajar</span>
  }
  if (baseline === Infinity) {
    return <span className="text-text-tertiary">desde sostenible</span>
  }
  const diff = Math.round(scenario - baseline)
  if (diff === 0) return <span className="text-text-tertiary">sin cambio</span>
  return (
    <span className={diff > 0 ? 'text-positive' : 'text-negative'}>
      {diff > 0 ? '+' : '−'}
      {Math.abs(diff)} {Math.abs(diff) === 1 ? 'mes' : 'meses'} vs hoy
    </span>
  )
}

function GoalRow({ goal, surplus }: { goal: WhatIfGoal; surplus: number }) {
  const months = goal.remaining > 0 ? goal.remaining / surplus : 0
  const days = Math.round(months * 30)

  let vs: { label: string; sooner: boolean } | null = null
  if (goal.daysToTarget !== null) {
    const diff = goal.daysToTarget - days
    const weeks = Math.max(1, Math.round(Math.abs(diff) / 7))
    vs = {
      label: `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} ${diff >= 0 ? 'antes' : 'después'}`,
      sooner: diff >= 0,
    }
  }

  const etaLabel =
    months >= 1
      ? `~${Math.round(months)} ${Math.round(months) === 1 ? 'mes' : 'meses'}`
      : 'menos de un mes'

  return (
    <li className="flex flex-wrap items-baseline justify-between gap-2">
      <span className="text-text min-w-0 truncate text-[13px]">{goal.name}</span>
      <span className="flex shrink-0 items-baseline gap-2 text-[12px]">
        <span className="text-text-secondary tabular">{etaLabel}</span>
        {vs && <span className={vs.sooner ? 'text-positive' : 'text-warning'}>· {vs.label}</span>}
      </span>
    </li>
  )
}
