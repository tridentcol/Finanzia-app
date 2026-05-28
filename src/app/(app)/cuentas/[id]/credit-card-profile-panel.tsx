'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { upsertCreditCardProfile } from '@/app/(app)/cuentas/actions'

type Profile = {
  allowsDirectedPayment: boolean
  interestRateMonthly: string | null
  paymentPolicy: 'total' | 'minimum' | 'partial'
  hasPromotionalTerms: boolean
  notes: string | null
}

const POLICY_LABELS: Record<Profile['paymentPolicy'], string> = {
  total: 'Pago total',
  minimum: 'Pago mínimo',
  partial: 'Pago parcial',
}

type Props = {
  accountId: string
  initial: Profile | null
}

export function CreditCardProfilePanel({ accountId, initial }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)

  const blank: Profile = {
    allowsDirectedPayment: false,
    interestRateMonthly: null,
    paymentPolicy: 'total',
    hasPromotionalTerms: false,
    notes: null,
  }

  const base = initial ?? blank

  const [allowsDirected, setAllowsDirected] = useState(base.allowsDirectedPayment)
  const [interestRate, setInterestRate] = useState(base.interestRateMonthly ?? '')
  const [policy, setPolicy] = useState<Profile['paymentPolicy']>(base.paymentPolicy)
  const [hasPromo, setHasPromo] = useState(base.hasPromotionalTerms)
  const [notes, setNotes] = useState(base.notes ?? '')

  function handleSave() {
    startTransition(async () => {
      const result = await upsertCreditCardProfile({
        accountId,
        allowsDirectedPayment: allowsDirected,
        interestRateMonthly: interestRate || null,
        paymentPolicy: policy,
        hasPromotionalTerms: hasPromo,
        notes: notes || null,
      })

      if (!result.ok) {
        toast.error(result.error.message)
        return
      }

      toast.success('Perfil actualizado.')
      router.refresh()
      setEditing(false)
    })
  }

  return (
    <div className="border-border-default flex flex-col gap-4 rounded-[12px] border p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h3 className="text-text text-sm font-semibold">Perfil de la tarjeta</h3>
          <p className="text-text-tertiary text-xs">
            Configura condiciones para el seguimiento y análisis de esta tarjeta.
          </p>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={() => setEditing(true)}>
            Editar
          </Button>
        )}
      </div>

      {!editing ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-text-tertiary">Política de pago</dt>
          <dd className="text-text-secondary text-right">{POLICY_LABELS[base.paymentPolicy]}</dd>

          <dt className="text-text-tertiary">Tasa mensual</dt>
          <dd className="text-text-secondary text-right font-mono tabular">
            {base.interestRateMonthly ? `${base.interestRateMonthly}%` : '—'}
          </dd>

          <dt className="text-text-tertiary">Pago dirigido</dt>
          <dd className="text-text-secondary text-right">
            {base.allowsDirectedPayment ? 'Sí' : 'No'}
          </dd>

          <dt className="text-text-tertiary">Condiciones promo</dt>
          <dd className="text-text-secondary text-right">
            {base.hasPromotionalTerms ? 'Sí' : 'No'}
          </dd>

          {base.notes && (
            <>
              <dt className="text-text-tertiary">Notas</dt>
              <dd className="text-text-secondary text-right">{base.notes}</dd>
            </>
          )}
        </dl>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Política de pago">
              <Select
                value={policy}
                onValueChange={(v) => setPolicy(v as Profile['paymentPolicy'])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="total">Pago total</SelectItem>
                  <SelectItem value="minimum">Pago mínimo</SelectItem>
                  <SelectItem value="partial">Pago parcial</SelectItem>
                </SelectContent>
              </Select>
            </Field>

            <Field label="Tasa mensual (%)" htmlFor="cc-rate">
              <Input
                id="cc-rate"
                inputMode="decimal"
                placeholder="2.45"
                className="tabular"
                value={interestRate}
                onChange={(e) => setInterestRate(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3 text-[13px]">
            <label className="border-border-default flex cursor-pointer items-center gap-3 rounded-[8px] border px-3 py-2.5">
              <input
                type="checkbox"
                className="accent-current h-3.5 w-3.5"
                checked={allowsDirected}
                onChange={(e) => setAllowsDirected(e.target.checked)}
              />
              <span className="text-text-secondary">Pago dirigido</span>
            </label>

            <label className="border-border-default flex cursor-pointer items-center gap-3 rounded-[8px] border px-3 py-2.5">
              <input
                type="checkbox"
                className="accent-current h-3.5 w-3.5"
                checked={hasPromo}
                onChange={(e) => setHasPromo(e.target.checked)}
              />
              <span className="text-text-secondary">Condiciones promo</span>
            </label>
          </div>

          <Field label="Notas" htmlFor="cc-notes">
            <Input
              id="cc-notes"
              placeholder="Ej. primera cuota sin interés"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </Field>

          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditing(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
