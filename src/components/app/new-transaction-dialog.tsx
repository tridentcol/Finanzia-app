'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { createTransaction } from '@/app/(app)/transacciones/actions'
import { useDialogStore } from './dialog-store'

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

type Props = {
  accounts: AccountOption[]
  categories: CategoryOption[]
}

const txKinds = [
  { value: 'expense' as const, label: 'Gasto' },
  { value: 'income' as const, label: 'Ingreso' },
  { value: 'transfer' as const, label: 'Transferencia' },
]

const schema = z.object({
  kind: z.enum(['income', 'expense', 'transfer']),
  accountId: z.string().min(1, 'Selecciona una cuenta'),
  transferAccountId: z.string().optional(),
  categoryId: z.string().optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida'),
  amountOriginal: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Monto positivo, formato 1234.56'),
  description: z.string().trim().min(1, 'Requerido').max(200),
  notes: z.string().max(500).optional(),
})

type FormValues = z.infer<typeof schema>

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function NewTransactionDialog({ accounts, categories }: Props) {
  const active = useDialogStore((s) => s.active)
  const close = useDialogStore((s) => s.close)
  const open = active === 'new-transaction'

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      {open && (
        <NewTransactionForm
          accounts={accounts}
          categories={categories}
          onDone={close}
        />
      )}
    </Dialog>
  )
}

function NewTransactionForm({
  accounts,
  categories,
  onDone,
}: Props & { onDone: () => void }) {
  const router = useRouter()
  const [serverError, setServerError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const defaultAccountId = accounts[0]?.id ?? ''
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      kind: 'expense',
      accountId: defaultAccountId,
      date: today(),
      amountOriginal: '',
      description: '',
    },
  })

  const kind = watch('kind')
  const accountId = watch('accountId')
  const account = accounts.find((a) => a.id === accountId)
  const transferOptions = accounts.filter((a) => a.id !== accountId)
  const categoryOptions = useMemo(
    () => categories.filter((c) => c.kind === kind),
    [categories, kind],
  )
  /**
   * Agrupa categorías por padre para que el Select muestre la jerarquía:
   * raíces con hijos van como SelectGroup; raíces sin hijos van sueltas.
   */
  const groupedCategories = useMemo(() => {
    const roots = categoryOptions.filter((c) => c.parentId === null)
    const childrenByParent = new Map<string, typeof categoryOptions>()
    for (const c of categoryOptions) {
      if (!c.parentId) continue
      const list = childrenByParent.get(c.parentId) ?? []
      list.push(c)
      childrenByParent.set(c.parentId, list)
    }
    return roots.map((root) => ({
      root,
      children: childrenByParent.get(root.id) ?? [],
    }))
  }, [categoryOptions])

  if (accounts.length === 0) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva transacción</DialogTitle>
          <DialogDescription>
            Necesitas al menos una cuenta antes de registrar movimientos.
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

  function onSubmit(values: FormValues) {
    setServerError(null)
    if (!account) {
      setServerError('Selecciona una cuenta.')
      return
    }
    startTransition(async () => {
      const result = await createTransaction({
        kind: values.kind,
        accountId: values.accountId,
        transferAccountId:
          values.kind === 'transfer' ? values.transferAccountId ?? null : null,
        categoryId: values.categoryId && values.categoryId !== '' ? values.categoryId : null,
        date: values.date,
        amountOriginal: values.amountOriginal,
        currency: account.currency as 'COP',
        description: values.description,
        merchant: null,
        notes: values.notes && values.notes !== '' ? values.notes : null,
      })

      if (!result.ok) {
        setServerError(result.error.message)
        toast.error(result.error.message)
        return
      }
      toast.success('Transacción registrada.')
      router.refresh()
      onDone()
    })
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Nueva transacción</DialogTitle>
        <DialogDescription>
          Registra un movimiento manual. Las transferencias entre cuentas
          requieren misma moneda por ahora.
        </DialogDescription>
      </DialogHeader>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
        <Field label="Tipo">
          <div className="border-border-default flex rounded-[8px] border p-0.5">
            {txKinds.map((k) => {
              const selected = kind === k.value
              return (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setValue('kind', k.value, { shouldValidate: true })}
                  className={`flex-1 rounded-[6px] py-1.5 text-sm transition-colors ${
                    selected
                      ? 'bg-surface-hover text-text'
                      : 'text-text-secondary hover:text-text'
                  }`}
                >
                  {k.label}
                </button>
              )
            })}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={kind === 'transfer' ? 'Desde' : 'Cuenta'}
            error={errors.accountId?.message}
          >
            <Select
              value={watch('accountId')}
              onValueChange={(v) =>
                setValue('accountId', v, { shouldValidate: true })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.name}
                    <span className="text-text-tertiary ml-2 text-[11px]">
                      {a.currency}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {kind === 'transfer' ? (
            <Field
              label="Hacia"
              error={errors.transferAccountId?.message}
            >
              <Select
                value={watch('transferAccountId') ?? ''}
                onValueChange={(v) =>
                  setValue('transferAccountId', v, { shouldValidate: true })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Cuenta destino" />
                </SelectTrigger>
                <SelectContent>
                  {transferOptions.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                      <span className="text-text-tertiary ml-2 text-[11px]">
                        {a.currency}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          ) : (
            <Field
              label="Categoría"
              hint={categoryOptions.length === 0 ? 'Sin categorías para este tipo' : undefined}
            >
              <Select
                value={watch('categoryId') ?? ''}
                onValueChange={(v) =>
                  setValue('categoryId', v, { shouldValidate: true })
                }
                disabled={categoryOptions.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría" />
                </SelectTrigger>
                <SelectContent>
                  {groupedCategories.map(({ root, children }, idx) => {
                    if (children.length === 0) {
                      return (
                        <SelectItem key={root.id} value={root.id}>
                          {root.name}
                        </SelectItem>
                      )
                    }
                    return (
                      <SelectGroup key={root.id}>
                        {idx > 0 && <SelectSeparator />}
                        <SelectLabel>{root.name}</SelectLabel>
                        <SelectItem value={root.id}>
                          Sin subcategoría
                        </SelectItem>
                        {children.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    )
                  })}
                </SelectContent>
              </Select>
            </Field>
          )}
        </div>

        <div className="grid grid-cols-[1fr_140px] gap-3">
          <Field
            label="Monto"
            htmlFor="tx-amount"
            error={errors.amountOriginal?.message}
            hint={account ? `Moneda: ${account.currency}` : undefined}
          >
            <Input
              id="tx-amount"
              inputMode="decimal"
              placeholder="0.00"
              className="tabular"
              {...register('amountOriginal')}
            />
          </Field>
          <Field label="Fecha" htmlFor="tx-date" error={errors.date?.message}>
            <Input id="tx-date" type="date" className="tabular" {...register('date')} />
          </Field>
        </div>

        <Field
          label="Descripción"
          htmlFor="tx-description"
          error={errors.description?.message}
        >
          <Input
            id="tx-description"
            placeholder="Mercado del sábado"
            {...register('description')}
          />
        </Field>

        <Field label="Notas" htmlFor="tx-notes" error={errors.notes?.message}>
          <Textarea
            id="tx-notes"
            placeholder="Detalles opcionales"
            {...register('notes')}
          />
        </Field>

        {serverError && <p className="text-negative text-xs">{serverError}</p>}

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onDone} disabled={pending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? 'Guardando…' : 'Guardar'}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  )
}
