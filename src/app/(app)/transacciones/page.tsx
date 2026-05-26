import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import {
  countUnclassifiedTransactions,
  listAvailableCategories,
  listTransactionsForUser,
  type TransactionFilters,
} from '@/lib/db/queries/transactions'
import { EmptyState } from '@/components/app/empty-state'
import { Amount } from '@/components/app/amount'
import { NewTransactionTrigger } from '@/components/app/new-transaction-trigger'
import { CategoryCell, type CategoryOption } from '@/components/app/category-cell'
import { RecategorizeButton } from '@/components/app/recategorize-button'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Transacciones',
}

type SearchParams = Promise<{
  kind?: string
  accountId?: string
}>

const kindFilters: Array<{
  value: TransactionFilters['kind'] | null
  label: string
}> = [
  { value: null, label: 'Todas' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'transfer', label: 'Transferencias' },
]

function kindParam(value: TransactionFilters['kind'] | null): string {
  if (!value) return ''
  return `?kind=${value}`
}

const kindToTone: Record<
  'income' | 'expense' | 'transfer',
  'positive' | 'negative' | 'neutral'
> = {
  income: 'positive',
  expense: 'negative',
  transfer: 'neutral',
}

export default async function TransaccionesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  const params = await searchParams

  const kind = (() => {
    if (params.kind === 'income' || params.kind === 'expense' || params.kind === 'transfer') {
      return params.kind
    }
    return undefined
  })()

  const [list, available, unclassified] = await Promise.all([
    listTransactionsForUser(user.id, {
      kind,
      accountId: params.accountId,
      limit: 200,
    }),
    listAvailableCategories(user.id),
    countUnclassifiedTransactions(user.id),
  ])
  const categoryOptions: CategoryOption[] = available.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    parentId: c.parentId,
  }))

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-text-secondary text-sm">Transacciones</p>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Bitácora
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RecategorizeButton pending={unclassified} />
          <NewTransactionTrigger />
        </div>
      </header>

      <nav
        aria-label="Filtros"
        className="border-border-default -mx-1 flex items-center gap-1 overflow-x-auto rounded-[8px] border p-0.5 self-start"
      >
        {kindFilters.map((f) => {
          const selected = (f.value ?? null) === (kind ?? null)
          return (
            <Link
              key={f.label}
              href={`/transacciones${kindParam(f.value)}`}
              className={cn(
                'rounded-[6px] px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors',
                selected
                  ? 'bg-surface-hover text-text'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover/60',
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </nav>

      {list.length === 0 ? (
        <EmptyState
          headline={
            kind
              ? 'No hay movimientos para este filtro.'
              : 'Sin movimientos para mostrar.'
          }
          body="Cuando importes un extracto o registres un gasto manualmente, lo verás aquí. Multi-divisa, ordenado, categorizable."
          action={<NewTransactionTrigger />}
        />
      ) : (
        <>
          {/* Mobile (<md): lista de cards apiladas */}
          <ul className="flex flex-col gap-2 md:hidden">
            {list.map((tx) => (
              <li
                key={tx.id}
                className="border-border-default bg-surface flex min-w-0 flex-col gap-2 rounded-[12px] border p-4"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-text truncate text-[14px]">{tx.description}</span>
                    <span className="text-text-tertiary truncate text-[11px]">
                      {formatRelativeDate(tx.date)} · {tx.account.name}
                      {tx.kind === 'transfer' && tx.transferAccount &&
                        ` → ${tx.transferAccount.name}`}
                    </span>
                  </div>
                  <Amount
                    value={tx.amountOriginal}
                    currency={tx.currency}
                    kind={kindToTone[tx.kind]}
                    showPositiveSign={tx.kind === 'income'}
                    className="shrink-0 text-[14px]"
                  />
                </div>
                <CategoryCell
                  transactionId={tx.id}
                  txKind={tx.kind}
                  currentCategoryId={tx.category?.id ?? null}
                  currentCategoryName={tx.category?.name ?? null}
                  aiCategorized={tx.aiCategorized}
                  aiConfidence={tx.aiConfidence}
                  options={categoryOptions}
                />
              </li>
            ))}
          </ul>

          {/* Desktop (>=md): tabla */}
          <div className="border-border-default bg-surface hidden overflow-hidden rounded-[12px] border md:block">
            <table className="w-full">
              <thead>
                <tr className="border-border-default text-text-tertiary border-b text-[11px] uppercase tracking-[0.08em]">
                  <th className="px-5 py-3 text-left font-medium">Fecha</th>
                  <th className="px-5 py-3 text-left font-medium">Descripción</th>
                  <th className="px-5 py-3 text-left font-medium">Cuenta</th>
                  <th className="px-5 py-3 text-left font-medium">Categoría</th>
                  <th className="px-5 py-3 text-right font-medium">Monto</th>
                </tr>
              </thead>
              <tbody>
                {list.map((tx) => (
                  <tr
                    key={tx.id}
                    className="border-border-default/60 hover:bg-surface-hover/60 border-b transition-colors last:border-b-0"
                  >
                    <td className="text-text-secondary tabular px-5 py-3.5 text-[13px]">
                      {formatRelativeDate(tx.date)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-col">
                        <span className="text-text text-sm">{tx.description}</span>
                        {tx.kind === 'transfer' && tx.transferAccount && (
                          <span className="text-text-tertiary text-[11px]">
                            {tx.account.name} → {tx.transferAccount.name}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-text-secondary px-5 py-3.5 text-sm">
                      {tx.account.name}
                    </td>
                    <td className="px-5 py-3.5">
                      <CategoryCell
                        transactionId={tx.id}
                        txKind={tx.kind}
                        currentCategoryId={tx.category?.id ?? null}
                        currentCategoryName={tx.category?.name ?? null}
                        aiCategorized={tx.aiCategorized}
                        aiConfidence={tx.aiConfidence}
                        options={categoryOptions}
                      />
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Amount
                        value={tx.amountOriginal}
                        currency={tx.currency}
                        kind={kindToTone[tx.kind]}
                        showPositiveSign={tx.kind === 'income'}
                        className="text-sm"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function formatRelativeDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(date)
}
