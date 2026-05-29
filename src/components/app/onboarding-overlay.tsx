'use client'

import { useState, useTransition } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { completeOnboarding, type OnboardingInput } from '@/app/(app)/ajustes/perfil-financiero/actions'

const SKIP_KEY = 'finanzia_onboarding_skip_until'
const SKIP_DAYS = 7

type Currency = 'COP' | 'USD' | 'EUR' | 'MXN'
type Locale = 'es-CO' | 'es-ES' | 'en-US' | 'es-MX'
type IncomeRange = 'under_2m' | '2m_5m' | '5m_10m' | '10m_20m' | 'over_20m' | 'prefer_not'
type SavingsMethod = 'percentage_income' | 'fixed_amount' | 'none' | 'other'

const CURRENCIES: { value: Currency; label: string; desc: string }[] = [
  { value: 'COP', label: 'COP', desc: 'Peso colombiano' },
  { value: 'USD', label: 'USD', desc: 'Dólar estadounidense' },
  { value: 'EUR', label: 'EUR', desc: 'Euro' },
  { value: 'MXN', label: 'MXN', desc: 'Peso mexicano' },
]

const LOCALES: { value: Locale; label: string; currency: Currency }[] = [
  { value: 'es-CO', label: 'Colombia', currency: 'COP' },
  { value: 'es-MX', label: 'México', currency: 'MXN' },
  { value: 'es-ES', label: 'España', currency: 'EUR' },
  { value: 'en-US', label: 'Estados Unidos', currency: 'USD' },
]

const INCOME_RANGES: { value: IncomeRange; label: string }[] = [
  { value: 'under_2m', label: 'Menos de $2M' },
  { value: '2m_5m', label: '$2M — $5M' },
  { value: '5m_10m', label: '$5M — $10M' },
  { value: '10m_20m', label: '$10M — $20M' },
  { value: 'over_20m', label: 'Más de $20M' },
  { value: 'prefer_not', label: 'Prefiero no decirlo' },
]

const SAVINGS_METHODS: { value: SavingsMethod; label: string; desc: string }[] = [
  { value: 'percentage_income', label: 'Porcentaje del ingreso', desc: 'Ej. 10% de lo que ganas cada mes' },
  { value: 'fixed_amount', label: 'Monto fijo mensual', desc: 'Ej. $500,000 al mes sin importar el ingreso' },
  { value: 'none', label: 'Sin plan por ahora', desc: 'Solo quiero ver mis gastos' },
  { value: 'other', label: 'Otro', desc: 'Lo defino yo después' },
]

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
        'rounded-[4px] border px-3 py-2 text-sm transition-colors text-left outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40',
        selected
          ? 'border-border-emphasis bg-surface-elevated text-text'
          : 'border-border-default text-text-secondary hover:border-border-emphasis hover:bg-surface-hover/40 hover:text-text',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

export function OnboardingOverlay({ isOnboarded }: { isOnboarded: boolean }) {
  const [open, setOpen] = useState(() => {
    if (typeof window === 'undefined') return false
    if (isOnboarded) return false
    const skipUntil = localStorage.getItem(SKIP_KEY)
    if (skipUntil && new Date(skipUntil) > new Date()) return false
    return true
  })
  const [step, setStep] = useState(0)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const [currency, setCurrency] = useState<Currency>('COP')
  const [locale, setLocale] = useState<Locale>('es-CO')
  const [incomeRange, setIncomeRange] = useState<IncomeRange | null>(null)
  const [method, setMethod] = useState<SavingsMethod | null>(null)
  const [percent, setPercent] = useState<number>(10)
  const [fixedAmount, setFixedAmount] = useState('')

  function handleLocaleSelect(loc: Locale) {
    setLocale(loc)
    const match = LOCALES.find((l) => l.value === loc)
    if (match) setCurrency(match.currency)
  }

  function handleSkip() {
    const until = new Date()
    until.setDate(until.getDate() + SKIP_DAYS)
    localStorage.setItem(SKIP_KEY, until.toISOString())
    setOpen(false)
  }

  function handleFinish() {
    if (!method) return
    setError(null)

    let params: OnboardingInput['params'] = null
    if (method === 'percentage_income') {
      params = { percent }
    } else if (method === 'fixed_amount' && fixedAmount) {
      params = { amount: fixedAmount, frequency: 'monthly' }
    }

    startTransition(async () => {
      const result = await completeOnboarding({
        baseCurrency: currency,
        locale,
        incomeRange,
        method,
        params,
      })
      if (result.ok) {
        setOpen(false)
      } else {
        setError(result.error.message)
      }
    })
  }

  const canAdvanceStep0 = true
  const canAdvanceStep1 = true
  const canFinish = method !== null

  const steps = [
    {
      headline: 'Bienvenido a Finanzia',
      sub: 'Cuéntanos dónde estás. Solo tardas 2 minutos.',
    },
    {
      headline: 'Tu ingreso mensual',
      sub: 'Aproximado. Lo usamos solo para calibrar recomendaciones.',
    },
    {
      headline: 'Tu meta de ahorro',
      sub: 'Puedes cambiarlo cuando quieras desde Ajustes.',
    },
  ]

  const current = steps[step]!

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip() }}>
      <DialogContent
        className="max-w-lg border-border-default bg-surface p-0 gap-0"
        hideClose
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Progress bar */}
        <div className="h-[2px] w-full bg-border-default rounded-t-[16px] overflow-hidden">
          <div
            className="h-full bg-text-secondary transition-all duration-300"
            style={{ width: `${((step + 1) / 3) * 100}%` }}
          />
        </div>

        <div className="flex flex-col gap-6 p-6 sm:p-8">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <p className="text-[11px] uppercase tracking-[0.08em] text-text-tertiary">
              Paso {step + 1} de 3
            </p>
            <h2 className="editorial italic text-text leading-[1.1] tracking-tight text-[32px] sm:text-[40px]">
              {current.headline}
            </h2>
            <p className="text-sm text-text-secondary mt-1">{current.sub}</p>
          </div>

          {/* Step content */}
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.06em]">
                  País de residencia
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {LOCALES.map((loc) => (
                    <Chip
                      key={loc.value}
                      selected={locale === loc.value}
                      onClick={() => handleLocaleSelect(loc.value)}
                    >
                      {loc.label}
                    </Chip>
                  ))}
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.06em]">
                  Moneda principal
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CURRENCIES.map((c) => (
                    <Chip
                      key={c.value}
                      selected={currency === c.value}
                      onClick={() => setCurrency(c.value)}
                    >
                      <span className="block font-mono text-[13px]">{c.label}</span>
                      <span className="block text-[11px] text-text-tertiary">{c.desc}</span>
                    </Chip>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.06em]">
                Ingreso mensual (en {currency})
              </p>
              <div className="grid grid-cols-2 gap-2">
                {INCOME_RANGES.map((r) => (
                  <Chip
                    key={r.value}
                    selected={incomeRange === r.value}
                    onClick={() => setIncomeRange(r.value)}
                  >
                    {r.label}
                  </Chip>
                ))}
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-2">
                {SAVINGS_METHODS.map((m) => (
                  <Chip
                    key={m.value}
                    selected={method === m.value}
                    onClick={() => setMethod(m.value)}
                  >
                    <span className="block text-[13px] font-medium">{m.label}</span>
                    <span className="block text-[11px] text-text-tertiary mt-0.5">{m.desc}</span>
                  </Chip>
                ))}
              </div>

              {method === 'percentage_income' && (
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.06em]">
                    Porcentaje a ahorrar
                  </p>
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
                <div className="flex flex-col gap-2 pt-1">
                  <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.06em]">
                    Monto mensual ({currency})
                  </p>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="500000"
                    value={fixedAmount}
                    onChange={(e) => setFixedAmount(e.target.value.replace(/[^0-9.]/g, ''))}
                    className="font-mono tabular-nums"
                  />
                </div>
              )}

              {error && <p className="text-sm text-negative">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-border-default px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={handleSkip}
            className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
          >
            Configurar más tarde
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                Atrás
              </Button>
            )}
            {step < 2 ? (
              <Button
                size="sm"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 ? !canAdvanceStep0 : !canAdvanceStep1}
              >
                Continuar
              </Button>
            ) : (
              <Button size="sm" onClick={handleFinish} disabled={!canFinish || isPending}>
                {isPending ? 'Guardando…' : 'Empezar'}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
