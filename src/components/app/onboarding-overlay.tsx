'use client'

import { useReducer, useState, useTransition } from 'react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { completeOnboarding, type OnboardingInput } from '@/app/(app)/ajustes/perfil-financiero/actions'
import { INITIAL_STATE, wizardReducer, type WizardState } from './onboarding/types'
import { BasicsStep, IncomeStep, SavingsStep } from './onboarding/steps-basics'
import {
  ClosingStep,
  CommStyleStep,
  FocusStep,
  LiteracyStep,
  TestStep,
} from './onboarding/steps-persona'

const SKIP_KEY = 'finanzia_onboarding_skip_until'
const SKIP_DAYS = 7

type Screen = {
  key: string
  headline: string
  sub: string
  /** Pasos de personalización: el primario dice "Omitir" mientras no haya selección. */
  optional?: boolean
  /** Último paso: el primario es "Empezar" (submit). */
  closing?: boolean
}

const TEST_SUB = 'No es un test de personalidad. Solo nos ayuda a hablarte como te sirve.'

const SCREENS: Screen[] = [
  { key: 'basics', headline: 'Bienvenido a Finanzia', sub: 'Cuéntanos dónde estás. Toma 2–3 minutos.' },
  { key: 'income', headline: 'Tu ingreso mensual', sub: 'Aproximado. Solo para calibrar recomendaciones.', optional: true },
  { key: 'savings', headline: 'Tu meta de ahorro', sub: 'Puedes cambiarlo desde Ajustes cuando quieras.' },
  { key: 'literacy', headline: '¿Qué tan a fondo te hablo?', sub: 'Ajusto cuánto explico los términos.', optional: true },
  { key: 'commStyle', headline: '¿Cómo prefieres que responda?', sub: 'Más directo o más detallado.', optional: true },
  { key: 'test0', headline: 'Cómo te relacionas con tu dinero', sub: TEST_SUB, optional: true },
  { key: 'test1', headline: 'Cómo te relacionas con tu dinero', sub: TEST_SUB, optional: true },
  { key: 'test2', headline: 'Cómo te relacionas con tu dinero', sub: TEST_SUB, optional: true },
  { key: 'focus', headline: '¿En qué te enfocas ahora?', sub: 'Priorizo eso en tus diagnósticos.', optional: true },
  { key: 'closing', headline: 'Quedó a tu medida', sub: '', closing: true },
]

/** ¿El usuario ya eligió algo en este paso? (para el label Omitir/Continuar). */
function hasSelection(key: string, s: WizardState): boolean {
  switch (key) {
    case 'income':
      return s.incomeRange !== null
    case 'literacy':
      return s.literacy !== null
    case 'commStyle':
      return s.commStyle !== null
    case 'test0':
      return s.p1 !== null
    case 'test1':
      return s.p2 !== null
    case 'test2':
      return s.p3 !== null
    case 'focus':
      return s.focus.length > 0
    default:
      return true
  }
}

function buildPersona(s: WizardState): OnboardingInput['persona'] {
  const testAnswers: { p1?: string; p2?: string; p3?: string } = {}
  if (s.p1) testAnswers.p1 = s.p1
  if (s.p2) testAnswers.p2 = s.p2
  if (s.p3) testAnswers.p3 = s.p3
  const persona = {
    ...(s.literacy ? { literacy: s.literacy } : {}),
    ...(s.commStyle ? { commStyle: s.commStyle } : {}),
    ...(s.focus.length > 0 ? { focus: s.focus } : {}),
    ...(Object.keys(testAnswers).length > 0 ? { testAnswers } : {}),
  }
  return Object.keys(persona).length > 0 ? persona : null
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
  const [state, dispatch] = useReducer(wizardReducer, INITIAL_STATE)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const total = SCREENS.length
  const screen = SCREENS[step]!
  const testIndex = screen.key.startsWith('test') ? Number(screen.key.slice(4)) : null
  const validFixedAmount = state.fixedAmount.trim() !== '' && Number(state.fixedAmount) > 0
  // savings exige un método; con "monto fijo" además un monto válido (si no, se
  // crearía un plan fixed_amount sin objetivo). El resto de pasos avanzan libres.
  const canAdvance =
    screen.key === 'savings'
      ? state.method !== null && (state.method !== 'fixed_amount' || validFixedAmount)
      : true

  function handleSkip() {
    const until = new Date()
    until.setDate(until.getDate() + SKIP_DAYS)
    localStorage.setItem(SKIP_KEY, until.toISOString())
    setOpen(false)
  }

  function handleFinish() {
    const method = state.method
    if (!method) return
    setError(null)
    let params: OnboardingInput['params'] = null
    if (method === 'percentage_income') params = { percent: state.percent }
    else if (method === 'fixed_amount' && state.fixedAmount)
      params = { amount: state.fixedAmount, frequency: 'monthly' }

    startTransition(async () => {
      const result = await completeOnboarding({
        baseCurrency: state.currency,
        locale: state.locale,
        incomeRange: state.incomeRange,
        method,
        params,
        persona: buildPersona(state),
      })
      if (result.ok) setOpen(false)
      else setError(result.error.message)
    })
  }

  function renderContent() {
    switch (screen.key) {
      case 'basics':
        return <BasicsStep state={state} dispatch={dispatch} />
      case 'income':
        return <IncomeStep state={state} dispatch={dispatch} />
      case 'savings':
        return <SavingsStep state={state} dispatch={dispatch} />
      case 'literacy':
        return <LiteracyStep state={state} dispatch={dispatch} />
      case 'commStyle':
        return <CommStyleStep state={state} dispatch={dispatch} />
      case 'test0':
      case 'test1':
      case 'test2':
        return <TestStep state={state} dispatch={dispatch} index={testIndex ?? 0} />
      case 'focus':
        return <FocusStep state={state} dispatch={dispatch} />
      case 'closing':
        return <ClosingStep />
      default:
        return null
    }
  }

  const primaryLabel = screen.closing
    ? isPending
      ? 'Guardando…'
      : 'Empezar'
    : screen.optional && !hasSelection(screen.key, state)
      ? 'Omitir'
      : 'Continuar'

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleSkip() }}>
      <DialogContent
        className="flex max-w-lg flex-col gap-0 overflow-hidden p-0 pt-[var(--safe-top)] pb-[var(--safe-bottom)] sm:pt-0 sm:pb-0"
        hideClose
        aria-describedby={undefined}
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Nombre accesible del diálogo (Radix lo exige); el headline visible es
            editorial y vive abajo. */}
        <DialogTitle className="sr-only">{screen.headline}</DialogTitle>

        <div className="bg-border-default h-[2px] w-full shrink-0 overflow-hidden sm:rounded-t-[16px]">
          <div
            className="bg-text-secondary h-full transition-all duration-300 motion-reduce:transition-none"
            style={{ width: `${((step + 1) / total) * 100}%` }}
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto p-6 sm:p-8">
          <div className="flex flex-col gap-1">
            {testIndex !== null ? (
              <div className="flex items-center gap-1.5" aria-hidden>
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className={`h-1 w-5 rounded-full ${i <= testIndex ? 'bg-text-secondary' : 'bg-border-default'}`}
                  />
                ))}
              </div>
            ) : (
              <p className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
                Paso {step + 1} de {total}
              </p>
            )}
            <h2 className="editorial text-text text-[32px] leading-[1.1] tracking-tight italic sm:text-[40px]">
              {screen.headline}
            </h2>
            {screen.sub && <p className="text-text-secondary mt-1 text-sm">{screen.sub}</p>}
          </div>

          {renderContent()}

          {error && <p className="text-negative text-sm">{error}</p>}
        </div>

        <div className="border-border-default flex shrink-0 items-center justify-between border-t px-6 py-4 sm:px-8">
          <button
            type="button"
            onClick={handleSkip}
            className="text-text-tertiary hover:text-text-secondary text-sm transition-colors"
          >
            Configurar más tarde
          </button>

          <div className="flex items-center gap-2">
            {step > 0 && (
              <Button variant="outline" size="sm" onClick={() => setStep((s) => s - 1)}>
                Atrás
              </Button>
            )}
            {screen.closing ? (
              <Button size="sm" onClick={handleFinish} disabled={!state.method || isPending}>
                {primaryLabel}
              </Button>
            ) : (
              <Button size="sm" onClick={() => setStep((s) => s + 1)} disabled={!canAdvance}>
                {primaryLabel}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
