'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  COMM_STYLE_OPTIONS,
  FOCUS_OPTIONS,
  HORIZON_OPTIONS,
  LITERACY_OPTIONS,
  MONEY_STYLE_OPTIONS,
  type CommStyle,
  type Focus,
  type Horizon,
  type Literacy,
  type MoneyStyle,
} from '@/lib/ai/copilot/persona'
import { updateFinancialPersona } from './actions'

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
      aria-pressed={selected}
      onClick={onClick}
      className={[
        'rounded-[4px] border px-3 py-1.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40',
        selected
          ? 'border-border-emphasis bg-surface-elevated text-text'
          : 'border-border-default text-text-secondary hover:border-border-emphasis hover:bg-surface-hover/40 hover:text-text',
      ].join(' ')}
    >
      {children}
    </button>
  )
}

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onSelect,
}: {
  label: string
  options: { value: T; label: string }[]
  value: T | null
  onSelect: (v: T | null) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-text-tertiary text-xs font-medium tracking-[0.06em] uppercase">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} selected={value === o.value} onClick={() => onSelect(value === o.value ? null : o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </div>
  )
}

export type ToneCardProps = {
  literacy: Literacy | null
  commStyle: CommStyle | null
  moneyStyle: MoneyStyle | null
  horizon: Horizon | null
  focus: Focus[]
}

/**
 * Tarjeta "Cómo te habla el copiloto": edita las señales de persona que ajustan
 * el tono (literacy/commStyle/moneyStyle/horizon/focus) sin repetir el mini-test.
 * Persiste vía updateFinancialPersona (merge campo a campo en aiProfile.persona).
 */
export function CopilotToneCard(initial: ToneCardProps) {
  const [literacy, setLiteracy] = useState(initial.literacy)
  const [commStyle, setCommStyle] = useState(initial.commStyle)
  const [moneyStyle, setMoneyStyle] = useState(initial.moneyStyle)
  const [horizon, setHorizon] = useState(initial.horizon)
  const [focus, setFocus] = useState<Focus[]>(initial.focus)
  const [pending, start] = useTransition()

  function toggleFocus(v: Focus) {
    setFocus((f) => (f.includes(v) ? f.filter((x) => x !== v) : f.length >= 2 ? f : [...f, v]))
  }

  function save() {
    start(async () => {
      const res = await updateFinancialPersona({ literacy, commStyle, moneyStyle, horizon, focus })
      if (res.ok) toast.success('Personalización guardada.')
      else toast.error(res.error.message)
    })
  }

  return (
    <div className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-4">
      <div className="flex flex-col gap-1">
        <p className="text-text text-sm font-medium">Cómo te habla el copiloto</p>
        <p className="text-text-secondary text-[13px]">
          Opcional. Ajusta el tono y la profundidad de las respuestas a tu forma de leer.
        </p>
      </div>

      <ChipGroup label="Conocimiento financiero" options={LITERACY_OPTIONS} value={literacy} onSelect={setLiteracy} />
      <ChipGroup label="Estilo de comunicación" options={COMM_STYLE_OPTIONS} value={commStyle} onSelect={setCommStyle} />
      <ChipGroup label="Relación con el dinero" options={MONEY_STYLE_OPTIONS} value={moneyStyle} onSelect={setMoneyStyle} />
      <ChipGroup label="Horizonte" options={HORIZON_OPTIONS} value={horizon} onSelect={setHorizon} />

      <div className="flex flex-col gap-2">
        <p className="text-text-tertiary text-xs font-medium tracking-[0.06em] uppercase">
          Foco actual (hasta 2)
        </p>
        <div className="flex flex-wrap gap-2">
          {FOCUS_OPTIONS.map((o) => (
            <Chip key={o.value} selected={focus.includes(o.value)} onClick={() => toggleFocus(o.value)}>
              {o.label}
            </Chip>
          ))}
        </div>
      </div>

      <Button size="sm" className="self-start" onClick={save} disabled={pending}>
        {pending ? 'Guardando…' : 'Guardar personalización'}
      </Button>
    </div>
  )
}
