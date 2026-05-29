'use client'

import { useState } from 'react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

type Props = {
  statementDay: number | null
  creditLimit: string | null
  currentBalance: string
  interestRateMonthly: string | null
  currency: string
}

type Result = {
  daysToStatement: number
  totalCost: number
  totalWithInterest: number
  utilizationAfter: number
}

export function PurchaseAnalyzer({
  statementDay,
  creditLimit,
  currentBalance,
  interestRateMonthly,
  currency,
}: Props) {
  const [amount, setAmount] = useState('')
  const [cuotas, setCuotas] = useState('1')
  const [result, setResult] = useState<Result | null>(null)

  function analyze() {
    const monto = Number.parseFloat(amount)
    const n = Number.parseInt(cuotas, 10)
    if (!Number.isFinite(monto) || monto <= 0 || !Number.isFinite(n) || n < 1) return

    const today = new Date().getUTCDate()
    const daysToStatement = statementDay
      ? statementDay >= today
        ? statementDay - today
        : 30 - today + statementDay
      : 0

    const r = interestRateMonthly ? Number.parseFloat(interestRateMonthly) / 100 : 0

    let totalWithInterest: number
    if (n === 1 || r === 0) {
      totalWithInterest = monto
    } else {
      // Cuota fija: M * r * (1+r)^n / ((1+r)^n - 1)
      const cuotaFija = (monto * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1)
      totalWithInterest = cuotaFija * n
    }
    const totalCost = totalWithInterest - monto

    const limit = creditLimit ? Number.parseFloat(creditLimit) : 0
    const balance = Number.parseFloat(currentBalance)
    const usedNow = balance < 0 ? -balance : 0
    const utilizationAfter = limit > 0 ? Math.min(1, (usedNow + monto) / limit) : 0

    setResult({ daysToStatement, totalCost, totalWithInterest, utilizationAfter })
  }

  const fmt = (v: number) =>
    v.toLocaleString('es-CO', { maximumFractionDigits: 0 })

  return (
    <div className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-5">
      <div className="flex flex-col gap-1">
        <h3 className="text-text text-sm font-semibold">Analizador de compra</h3>
        <p className="text-text-tertiary text-xs">
          Simula el costo real de una compra a cuotas con esta tarjeta.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Monto" htmlFor="pa-amount">
          <Input
            id="pa-amount"
            inputMode="decimal"
            placeholder="500000"
            className="tabular"
            value={amount}
            onChange={(e) => { setAmount(e.target.value); setResult(null) }}
          />
        </Field>
        <Field label="Cuotas" htmlFor="pa-cuotas">
          <Input
            id="pa-cuotas"
            type="number"
            min={1}
            max={60}
            placeholder="12"
            className="tabular"
            value={cuotas}
            onChange={(e) => { setCuotas(e.target.value); setResult(null) }}
          />
        </Field>
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={analyze}
        disabled={!amount || Number.parseFloat(amount) <= 0}
      >
        Calcular
      </Button>

      {result && (
        <dl className="border-border-default/60 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t pt-4 text-[13px]">
          {statementDay && (
            <>
              <dt className="text-text-tertiary">Días al corte</dt>
              <dd className="text-text-secondary text-right tabular">{result.daysToStatement}d</dd>
            </>
          )}
          <dt className="text-text-tertiary">Total a pagar</dt>
          <dd className="text-text-secondary text-right font-mono tabular">
            ${fmt(result.totalWithInterest)} {currency}
          </dd>
          {result.totalCost > 0 && (
            <>
              <dt className="text-text-tertiary">Costo financiero</dt>
              <dd className="text-negative text-right font-mono tabular">
                +${fmt(result.totalCost)} {currency}
              </dd>
            </>
          )}
          <dt className="text-text-tertiary">Utilización tras compra</dt>
          <dd
            className={`text-right font-mono tabular ${
              result.utilizationAfter >= 0.9
                ? 'text-negative'
                : result.utilizationAfter >= 0.6
                  ? 'text-warning'
                  : 'text-text-secondary'
            }`}
          >
            {Math.round(result.utilizationAfter * 100)}%
          </dd>
        </dl>
      )}
    </div>
  )
}
