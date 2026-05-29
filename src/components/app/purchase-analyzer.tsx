'use client'

import { useState } from 'react'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  analyzePurchase,
  type PurchaseAnalysisResult,
} from '@/lib/cards/purchase-analysis'

type Props = {
  statementDay: number | null
  creditLimit: string | null
  currentBalance: string
  interestRateMonthly: string | null
  currency: string
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
  const [result, setResult] = useState<PurchaseAnalysisResult | null>(null)

  function analyze() {
    const monto = Number.parseFloat(amount)
    const n = Number.parseInt(cuotas, 10)
    if (!Number.isFinite(monto) || monto <= 0 || !Number.isFinite(n) || n < 1) return

    setResult(
      analyzePurchase({
        amount: monto,
        installments: n,
        statementDay,
        creditLimit: creditLimit ? Number.parseFloat(creditLimit) : null,
        currentBalance: Number.parseFloat(currentBalance),
        interestRateMonthly: interestRateMonthly
          ? Number.parseFloat(interestRateMonthly) / 100
          : null,
      }),
    )
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
          {result.daysToStatement !== null && (
            <>
              <dt className="text-text-tertiary">Días al corte</dt>
              <dd className="text-text-secondary text-right tabular">{result.daysToStatement}d</dd>
            </>
          )}
          {result.monthlyInstallment !== result.totalWithInterest && (
            <>
              <dt className="text-text-tertiary">Cuota mensual</dt>
              <dd className="text-text-secondary text-right font-mono tabular">
                ${fmt(result.monthlyInstallment)} {currency}
              </dd>
            </>
          )}
          <dt className="text-text-tertiary">Total a pagar</dt>
          <dd className="text-text-secondary text-right font-mono tabular">
            ${fmt(result.totalWithInterest)} {currency}
          </dd>
          {result.totalInterest > 0 && (
            <>
              <dt className="text-text-tertiary">Costo financiero</dt>
              <dd className="text-negative text-right font-mono tabular">
                +${fmt(result.totalInterest)} {currency}
              </dd>
            </>
          )}
          {result.utilizationTone !== 'unknown' && (
            <>
              <dt className="text-text-tertiary">Utilización tras compra</dt>
              <dd
                className={`text-right font-mono tabular ${
                  result.utilizationTone === 'danger'
                    ? 'text-negative'
                    : result.utilizationTone === 'warning'
                      ? 'text-warning'
                      : 'text-text-secondary'
                }`}
              >
                {Math.round(result.utilizationAfter * 100)}%
              </dd>
            </>
          )}
        </dl>
      )}
    </div>
  )
}
