'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { updateDebt } from '@/app/(app)/mi-dinero/deudas/actions'
import type { Debt } from '@/lib/db/schema'
import {
  DebtFormFields,
  debtFormSchema,
  type DebtFormValues,
} from './debt-form-fields'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  debt: Debt
}

/**
 * Edición de una deuda existente. Reusa el formulario compartido y la action
 * canónica updateDebt. Actualizar "Saldo actual" es la forma de registrar el
 * avance de un pago (la cuota baja el saldo pendiente).
 */
export function EditDebtDialog({ open, onOpenChange, debt }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && <EditDebtForm debt={debt} onDone={() => onOpenChange(false)} />}
    </Dialog>
  )
}

function EditDebtForm({ debt, onDone }: { debt: Debt; onDone: () => void }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<DebtFormValues>({
    resolver: zodResolver(debtFormSchema),
    defaultValues: {
      name: debt.name,
      lender: debt.lender ?? undefined,
      type: debt.type,
      currency: debt.currency,
      principal: debt.principal,
      currentBalance: debt.currentBalance,
      interestRate: debt.interestRate ?? undefined,
      installmentAmount: debt.installmentAmount ?? undefined,
      termMonths: debt.termMonths != null ? String(debt.termMonths) : undefined,
      originDate: debt.originDate ?? undefined,
      nextPaymentDate: debt.nextPaymentDate ?? undefined,
      paymentDay: debt.paymentDay != null ? String(debt.paymentDay) : undefined,
      notes: debt.notes ?? undefined,
    },
  })

  function onSubmit(values: DebtFormValues) {
    setServerError(null)
    startTransition(async () => {
      const result = await updateDebt({
        id: debt.id,
        name: values.name,
        lender: values.lender?.trim() || null,
        type: values.type as 'loan_personal',
        currency: values.currency,
        principal: values.principal,
        currentBalance: values.currentBalance,
        interestRate: values.interestRate?.trim() || null,
        installmentAmount: values.installmentAmount?.trim() || null,
        termMonths: values.termMonths ? Number.parseInt(values.termMonths, 10) : null,
        originDate: values.originDate || null,
        nextPaymentDate: values.nextPaymentDate || null,
        paymentDay: values.paymentDay ? Number.parseInt(values.paymentDay, 10) : null,
        notes: values.notes?.trim() || null,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }

      toast.success('Deuda actualizada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Editar deuda</DialogTitle>
        <DialogDescription>
          Actualiza los datos de {debt.name}. Bajar el saldo actual registra el avance
          de tus pagos.
        </DialogDescription>
      </DialogHeader>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-32px)] flex-col gap-4 overflow-y-auto pr-1"
      >
        <DebtFormFields form={form} balanceHint="Lo que aún debes — bajalo al pagar" />

        {serverError && <p className="text-negative text-xs">{serverError}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar cambios'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
