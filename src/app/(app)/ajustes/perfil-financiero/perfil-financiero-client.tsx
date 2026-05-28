'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import type { SavingsPlan } from '@/lib/db/schema'
import { updateSavingsPlan, type UpdatePlanInput } from './actions'

type Currency = 'COP' | 'USD' | 'EUR' | 'MXN'
type Locale = 'es-CO' | 'es-ES' | 'en-US' | 'es-MX'
type SavingsMethod = 'percentage_income' | 'fixed_amount' | 'none' | 'other'

const METHOD_LABELS: Record<SavingsMethod, string> = {
  percentage_income: 'Porcentaje del ingreso',
  fixed_amount: 'Monto fijo mensual',
  none: 'Sin plan',
  other: 'Personalizado',
}

const PERCENTAGES = [5, 10, 15, 20, 25, 30]

function Chip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'rounded-[4px] border px-3 py-2 text-sm transition-colors text-left',
        selected
          ? 'border-[--text] bg-[--surface-elevated] text-[--text]'
          : 'border-[--border] text-[--text-secondary] hover:border-[--border-emphasis] hover:text-[--text]',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function PlanDetail({ plan }: { plan: SavingsPlan }) {
  const params = plan.params as Record<string, unknown> | null
  const method = plan.method as SavingsMethod

  let detail = ''
  if (method === 'percentage_income' && params?.percent) {
    detail = `${params.percent}% del ingreso mensual`
  } else if (method === 'fixed_amount' && params?.amount) {
    detail = `${Number(params.amount).toLocaleString()} al mes`
  }

  return (
    <div className="rounded-[12px] border border-[--border] bg-[--surface] p-4">
      <p className="text-xs uppercase tracking-[0.06em] text-[--text-tertiary] mb-1">Plan activo</p>
      <p className="text-sm font-medium text-[--text]">{METHOD_LABELS[method]}</p>
      {detail && <p className="text-sm text-[--text-secondary] mt-0.5">{detail}</p>}
      <p className="text-xs text-[--text-tertiary] mt-2">Desde {plan.activeFrom}</p>
    </div>
  )
}

export function PerfilFinancieroClient({
  baseCurrency,
  locale,
  activePlan,
  isOnboarded,
}: {
  baseCurrency: Currency
  locale: Locale
  activePlan: SavingsPlan | null
  isOnboarded: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [method, setMethod] = useState<SavingsMethod>(
    (activePlan?.method as SavingsMethod | undefined) ?? 'none',
  )
  const [percent, setPercent] = useState<number>(
    (activePlan?.params as { percent?: number } | null)?.percent ?? 10,
  )
  const [fixedAmount, setFixedAmount] = useState(
    (activePlan?.params as { amount?: string } | null)?.amount ?? '',
  )
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    setError(null)
    let params: UpdatePlanInput['params'] = null
    if (method === 'percentage_income') params = { percent }
    else if (method === 'fixed_amount' && fixedAmount) params = { amount: fixedAmount, frequency: 'monthly' }

    startTransition(async () => {
      const result = await updateSavingsPlan({ method, params })
      if (result.ok) {
        setEditing(false)
      } else {
        setError(result.error.message)
      }
    })
  }

  const SAVINGS_METHODS: { value: SavingsMethod; label: string; desc: string }[] = [
    { value: 'percentage_income', label: 'Porcentaje del ingreso', desc: `Ej. 10% de lo que ganas al mes` },
    { value: 'fixed_amount', label: 'Monto fijo mensual', desc: `Ej. 500,000 ${baseCurrency} al mes` },
    { value: 'none', label: 'Sin plan', desc: 'Solo quiero ver mis gastos' },
    { value: 'other', label: 'Otro', desc: 'Lo defino más adelante' },
  ]

  return (
    <div className="flex flex-col gap-6">
      {/* Profile summary */}
      <div className="rounded-[12px] border border-[--border] bg-[--surface] p-4 flex flex-col gap-1">
        <p className="text-xs uppercase tracking-[0.06em] text-[--text-tertiary]">Configuración actual</p>
        <div className="flex items-center gap-4 mt-1">
          <div>
            <p className="text-xs text-[--text-tertiary]">Moneda base</p>
            <p className="text-sm font-mono font-medium text-[--text]">{baseCurrency}</p>
          </div>
          <div className="w-px h-6 bg-[--border]" />
          <div>
            <p className="text-xs text-[--text-tertiary]">Región</p>
            <p className="text-sm text-[--text]">{locale}</p>
          </div>
          {!isOnboarded && (
            <>
              <div className="w-px h-6 bg-[--border]" />
              <div>
                <span className="inline-block rounded-[4px] border border-[--border] bg-[--surface-elevated] px-2 py-0.5 text-[11px] text-[--text-tertiary]">
                  Onboarding pendiente
                </span>
              </div>
            </>
          )}
        </div>
        <p className="text-[11px] text-[--text-tertiary] mt-2">
          Para cambiar moneda o región, contacta soporte o edita tu perfil de Clerk.
        </p>
      </div>

      {/* Savings plan */}
      {!editing ? (
        <div className="flex flex-col gap-3">
          {activePlan ? (
            <PlanDetail plan={activePlan} />
          ) : (
            <div className="rounded-[12px] border border-dashed border-[--border] bg-[--surface] p-4">
              <p className="text-sm text-[--text-secondary]">Sin plan de ahorro configurado.</p>
            </div>
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={() => setEditing(true)}>
            {activePlan ? 'Cambiar plan' : 'Configurar plan'}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4 rounded-[12px] border border-[--border] bg-[--surface] p-4">
          <p className="text-sm font-medium text-[--text]">Nuevo plan de ahorro</p>

          <div className="grid grid-cols-1 gap-2">
            {SAVINGS_METHODS.map((m) => (
              <Chip
                key={m.value}
                selected={method === m.value}
                onClick={() => setMethod(m.value)}
              >
                <span className="block text-[13px] font-medium">{m.label}</span>
                <span className="block text-[11px] text-[--text-tertiary] mt-0.5">{m.desc}</span>
              </Chip>
            ))}
          </div>

          {method === 'percentage_income' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.06em] text-[--text-tertiary]">Porcentaje</p>
              <div className="flex flex-wrap gap-2">
                {PERCENTAGES.map((p) => (
                  <Chip key={p} selected={percent === p} onClick={() => setPercent(p)}>
                    {p}%
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {method === 'fixed_amount' && (
            <div className="flex flex-col gap-2">
              <p className="text-xs uppercase tracking-[0.06em] text-[--text-tertiary]">
                Monto mensual ({baseCurrency})
              </p>
              <input
                type="text"
                inputMode="decimal"
                placeholder="500000"
                value={fixedAmount}
                onChange={(e) => setFixedAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                className="h-10 rounded-[8px] border border-[--border] bg-[--surface-elevated] px-3 font-mono text-sm text-[--text] placeholder:text-[--text-tertiary] focus:outline-none focus:border-[--text-secondary]"
              />
            </div>
          )}

          {error && <p className="text-sm text-[--negative]">{error}</p>}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={isPending}>
              {isPending ? 'Guardando…' : 'Guardar plan'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
