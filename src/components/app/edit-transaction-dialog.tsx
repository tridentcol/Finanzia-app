'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { updateTransaction } from '@/app/(app)/mi-dinero/movimientos/actions'
import { CategoryCombobox } from './category-combobox'

type AccountOption = {
  id: string
  name: string
  currency: string
  type: string
}

type CategoryOption = {
  id: string
  name: string
  kind: 'income' | 'expense' | 'transfer'
  parentId: string | null
}

const ACCOUNT_TYPE_LABEL: Record<string, string> = {
  checking: 'Corriente',
  savings: 'Ahorros',
  credit_card: 'Tarjeta',
  cash: 'Efectivo',
  investment: 'Inversión',
  crypto: 'Cripto',
  other: 'Otra',
}

type Tx = {
  id: string
  kind: 'income' | 'expense' | 'transfer'
  accountId: string
  categoryId: string | null
  date: string
  amountOriginal: string
  currency: string
  description: string
  notes: string | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  transaction: Tx | null
  accounts: AccountOption[]
  categories: CategoryOption[]
}

export function EditTransactionDialog({
  open,
  onOpenChange,
  transaction,
  accounts,
  categories,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {open && transaction && (
        <EditTransactionForm
          transaction={transaction}
          accounts={accounts}
          categories={categories}
          onDone={() => onOpenChange(false)}
        />
      )}
    </Dialog>
  )
}

function EditTransactionForm({
  transaction,
  accounts,
  categories,
  onDone,
}: {
  transaction: Tx
  accounts: AccountOption[]
  categories: CategoryOption[]
  onDone: () => void
}) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const [accountId, setAccountId] = useState(transaction.accountId)
  const [categoryId, setCategoryId] = useState(transaction.categoryId ?? '')
  const [date, setDate] = useState(transaction.date)
  const [amount, setAmount] = useState(transaction.amountOriginal)
  const [description, setDescription] = useState(transaction.description)
  const [notes, setNotes] = useState(transaction.notes ?? '')

  const account = accounts.find((a) => a.id === accountId)
  const eligibleCategories = useMemo(
    () => categories.filter((c) => c.kind === transaction.kind),
    [categories, transaction.kind],
  )

  // Si el kind no admite la categoría actual, la limpiamos.
  useEffect(() => {
    if (categoryId && !eligibleCategories.some((c) => c.id === categoryId)) {
      setCategoryId('')
    }
  }, [eligibleCategories, categoryId])

  const isTransfer = transaction.kind === 'transfer'

  if (isTransfer) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Las transferencias no se editan</DialogTitle>
          <DialogDescription>
            Por la mecánica de espejo cross-currency, las transferencias no
            son editables. Bórrala y crea una nueva si necesitás cambios.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onDone}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setServerError(null)
    if (!account) {
      setServerError('Selecciona una cuenta.')
      return
    }
    if (!amount || !/^\d+(\.\d{1,2})?$/.test(amount)) {
      setServerError('Monto inválido. Usa formato 1234 o 1234.56.')
      return
    }
    if (!description.trim()) {
      setServerError('Escribe una descripción.')
      return
    }

    startTransition(async () => {
      const result = await updateTransaction({
        id: transaction.id,
        accountId,
        categoryId: categoryId || null,
        date,
        amountOriginal: amount,
        description: description.trim(),
        notes: notes.trim() || null,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }
      toast.success('Movimiento actualizado.')
      router.refresh()
      onDone()
    })
  }

  const kindLabel =
    transaction.kind === 'income' ? 'ingreso' : 'gasto'

  return (
    <DialogContent className="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>Editar {kindLabel}</DialogTitle>
        <DialogDescription className="sr-only">
          Edita los datos del movimiento. El tipo y la moneda no se pueden cambiar.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Monto · {transaction.currency}
          </label>
          <Input
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ''))}
            placeholder="0.00"
            className="tabular"
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Cuenta
            </label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <span className="flex items-center gap-2">
                      <span>{a.name}</span>
                      <span className="text-text-tertiary text-[11px]">
                        {ACCOUNT_TYPE_LABEL[a.type] ?? a.type} · {a.currency}
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              Categoría
            </label>
            <CategoryCombobox
              options={eligibleCategories.map((c) => ({
                id: c.id,
                name: c.name,
              }))}
              value={categoryId}
              onChange={setCategoryId}
              disabled={eligibleCategories.length === 0}
              placeholder={
                eligibleCategories.length === 0
                  ? 'Sin categorías'
                  : 'Sin categorizar'
              }
              emptyLabel="Sin categorizar"
            />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Descripción
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Fecha
          </label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="tabular"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
            Notas
          </label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </div>

        {serverError && (
          <p className="text-negative text-[12px]">{serverError}</p>
        )}

        <DialogFooter className="sm:gap-2">
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
