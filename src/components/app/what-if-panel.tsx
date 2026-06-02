'use client'

import { useState } from 'react'

import { formatMoney } from '@/lib/currency/format'
import type { CurrencyCode } from '@/lib/currency/currencies'

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
 * Simulador de escenarios. El usuario mueve cuánto ahorraría de más al mes
 * (recortando gasto) y ve, client-side: el saldo proyectado a 90 días con vs
 * sin el recorte, y por cada meta, en cuánto la alcanzaría dirigiendo ese
 * ahorro y cuántas semanas antes/después de su fecha objetivo. Modelo lineal
 * honesto sobre la proyección y las metas que ya existen.
 */
export function WhatIfPanel({
  balance90,
  maxDelta,
  goals,
  baseCurrency,
}: {
  balance90: number
  maxDelta: number
  goals: WhatIfGoal[]
  baseCurrency: CurrencyCode
}) {
  const step = Math.max(10_000, Math.round(maxDelta / 20 / 10_000) * 10_000)
  const [delta, setDelta] = useState(0)

  const scenario90 = balance90 + delta * 3
  const fmt = (v: number) => formatMoney(v, { currency: baseCurrency, compact: true })

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-text text-sm font-semibold">Escenarios</h2>
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          ¿Y si ahorras más?
        </span>
      </header>

      <div className="border-border-default bg-surface flex flex-col gap-6 rounded-[12px] border p-5 lg:p-6">
        {/* Control */}
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-text-secondary text-[13px]">
              Ahorro extra al mes
            </span>
            <span className="text-text amount text-2xl">{fmt(delta)}</span>
          </div>
          <input
            type="range"
            min={0}
            max={maxDelta}
            step={step}
            value={delta}
            onChange={(e) => setDelta(Number(e.target.value))}
            aria-label="Ahorro extra al mes"
            className="w-full"
            style={{ accentColor: 'var(--text-secondary)' }}
          />
          <p className="text-text-tertiary text-[12px]">
            Movilo para simular recortar gasto discrecional. El cálculo es al instante.
          </p>
        </div>

        {delta === 0 ? (
          <p className="text-text-tertiary editorial text-[15px] italic">
            Mové el control para ver el efecto sobre tu saldo y tus metas.
          </p>
        ) : (
          <div className="flex flex-col gap-5">
            {/* Saldo a 90 días */}
            <div className="border-border-default/60 flex flex-wrap items-baseline justify-between gap-3 border-t pt-5">
              <div className="flex flex-col gap-0.5">
                <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                  Saldo proyectado a 90 días
                </span>
                <span className="text-text amount text-2xl">{fmt(scenario90)}</span>
              </div>
              <span className="text-positive tabular text-[13px]">
                +{fmt(delta * 3)} vs tu proyección actual
              </span>
            </div>

            {/* Impacto en metas */}
            {goals.length > 0 && (
              <div className="flex flex-col gap-3">
                <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                  Si lo diriges a una meta
                </span>
                <ul className="flex flex-col gap-3">
                  {goals.map((g) => (
                    <GoalRow key={g.id} goal={g} delta={delta} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

function GoalRow({ goal, delta }: { goal: WhatIfGoal; delta: number }) {
  // Meses para completar dirigiendo el ahorro extra a esta meta.
  const months = goal.remaining > 0 ? goal.remaining / delta : 0
  const days = Math.round(months * 30)

  // Comparación vs la fecha objetivo del usuario.
  let vs: { label: string; sooner: boolean } | null = null
  if (goal.daysToTarget !== null) {
    const diff = goal.daysToTarget - days
    const weeks = Math.max(1, Math.round(Math.abs(diff) / 7))
    vs = { label: `${weeks} ${weeks === 1 ? 'semana' : 'semanas'} ${diff >= 0 ? 'antes' : 'después'}`, sooner: diff >= 0 }
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
        {vs && (
          <span className={vs.sooner ? 'text-positive' : 'text-warning'}>· {vs.label}</span>
        )}
      </span>
    </li>
  )
}
