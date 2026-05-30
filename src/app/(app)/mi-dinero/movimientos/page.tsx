import type { Metadata } from 'next'
import Link from 'next/link'
import { eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { profiles } from '@/lib/db/schema'
import {
  countUnclassifiedTransactions,
  listAvailableCategories,
  listTransactionsForUser,
  listUserAccountsBasic,
  type TransactionFilters,
} from '@/lib/db/queries/transactions'
import { listImportBatchesForUser } from '@/lib/db/queries/imports'
import { EmptyState } from '@/components/app/empty-state'
import { Amount } from '@/components/app/amount'
import { NewTransactionTrigger } from '@/components/app/new-transaction-trigger'
import { CategoryCell, type CategoryOption } from '@/components/app/category-cell'
import { RecategorizeButton } from '@/components/app/recategorize-button'
import { ImportDialog } from '@/components/app/import-dialog'
import { DayPickerNav } from '@/components/app/day-picker-nav'
import { TransactionActionsMenu } from '@/components/app/transaction-actions-menu'
import { MovimientosFilters } from '@/components/app/movimientos-filters'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Movimientos',
}

type SearchParams = Promise<{
  kind?: string
  accountId?: string
  categoryId?: string
  day?: string
  import?: string
  /** Filtro por comercio — slug normalizado, set desde /mi-historia/comercios. */
  merchant?: string
  /** Búsqueda libre (sustring case-insensitive sobre desc/merchant). */
  q?: string
  /** Rango de fechas custom. */
  from?: string
  to?: string
  /** Rango de montos. */
  minAmount?: string
  maxAmount?: string
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

  const dayFilter = /^\d{4}-\d{2}-\d{2}$/.test(params.day ?? '') ? params.day : undefined
  const merchantFilter = params.merchant?.trim() ? params.merchant.trim().toLowerCase() : undefined
  const searchQuery = params.q?.trim() ? params.q.trim() : undefined
  const fromFilter = /^\d{4}-\d{2}-\d{2}$/.test(params.from ?? '') ? params.from : undefined
  const toFilter = /^\d{4}-\d{2}-\d{2}$/.test(params.to ?? '') ? params.to : undefined
  const minAmount = /^\d+(\.\d{1,2})?$/.test(params.minAmount ?? '')
    ? params.minAmount
    : undefined
  const maxAmount = /^\d+(\.\d{1,2})?$/.test(params.maxAmount ?? '')
    ? params.maxAmount
    : undefined
  const categoryFilter = params.categoryId?.trim() || undefined
  const hasCustomFilter =
    Boolean(searchQuery) ||
    Boolean(fromFilter) ||
    Boolean(toFilter) ||
    Boolean(minAmount) ||
    Boolean(maxAmount) ||
    Boolean(categoryFilter)

  const [list, available, unclassified, accounts, batches, profile] = await Promise.all([
    listTransactionsForUser(user.id, {
      kind: dayFilter ? undefined : kind,
      accountId: params.accountId,
      categoryId: categoryFilter,
      merchantSlug: merchantFilter,
      searchQuery,
      from: dayFilter ?? fromFilter,
      to: dayFilter ?? toFilter,
      minAmount,
      maxAmount,
      limit: dayFilter ? 500 : (merchantFilter || hasCustomFilter) ? 500 : 200,
    }),
    listAvailableCategories(user.id),
    dayFilter ? Promise.resolve(0) : countUnclassifiedTransactions(user.id),
    listUserAccountsBasic(user.id),
    listImportBatchesForUser(user.id, 12),
    db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) }),
  ])
  const baseCurrency = profile?.baseCurrency ?? 'COP'
  const categoryOptions: CategoryOption[] = available.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    parentId: c.parentId,
  }))

  // Net delta for day view
  const dayNet = dayFilter
    ? list.reduce((acc, tx) => {
        if (tx.kind === 'income') return acc + Number.parseFloat(tx.amountBase)
        if (tx.kind === 'expense') return acc - Number.parseFloat(tx.amountBase)
        return acc
      }, 0)
    : null

  const dayLabel = dayFilter
    ? new Date(dayFilter + 'T12:00:00Z').toLocaleDateString('es-CO', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : null

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          {dayFilter ? (
            <>
              <Link
                href="/mi-dinero/movimientos"
                className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
              >
                ← Movimientos
              </Link>
              <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] capitalize sm:text-3xl">
                {dayLabel}
              </h1>
              {dayNet !== null && (
                <p
                  className={`amount mt-1 block truncate text-[28px] sm:text-4xl md:text-5xl ${dayNet >= 0 ? 'text-positive' : 'text-negative'}`}
                >
                  {dayNet >= 0 ? '+' : ''}
                  {dayNet.toLocaleString('es-CO', { maximumFractionDigits: 0 })}
                </p>
              )}
              {dayNet !== null && (
                <p className="text-text-tertiary text-xs">
                  Delta neto del día · {list.length}{' '}
                  {list.length === 1 ? 'movimiento' : 'movimientos'}
                </p>
              )}
            </>
          ) : (
            <>
              <p className="text-text-secondary text-sm">Movimientos</p>
              <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
                Bitácora
              </h1>
              {hasCustomFilter && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {searchQuery && (
                    <span
                      className="border-border-emphasis bg-surface-hover/60 text-text-secondary inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-[12px]"
                    >
                      Buscando “{searchQuery}”
                    </span>
                  )}
                  {(fromFilter || toFilter) && (
                    <span className="border-border-emphasis bg-surface-hover/60 text-text-secondary inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-[12px]">
                      Fechas {fromFilter ?? '…'} → {toFilter ?? '…'}
                    </span>
                  )}
                  {(minAmount || maxAmount) && (
                    <span className="border-border-emphasis bg-surface-hover/60 text-text-secondary inline-flex items-center gap-1.5 rounded-[6px] border px-2 py-0.5 text-[12px]">
                      Monto {minAmount ?? '0'} – {maxAmount ?? '∞'}
                    </span>
                  )}
                  <Link
                    href="/mi-dinero/movimientos"
                    className="text-text-tertiary hover:text-text-secondary text-[12px] underline-offset-2 transition-colors hover:underline"
                  >
                    Limpiar filtros
                  </Link>
                  <span className="text-text-tertiary text-[12px]">
                    · {list.length} {list.length === 1 ? 'resultado' : 'resultados'}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!dayFilter && (
            <>
              <DayPickerNav initialDay={null} />
              <MovimientosFilters categories={categoryOptions} />
              <ImportDialog accounts={accounts} batches={batches} />
              <RecategorizeButton pending={unclassified} />
            </>
          )}
          {dayFilter && <DayPickerNav initialDay={dayFilter} />}
          <NewTransactionTrigger />
        </div>
      </header>

      {!dayFilter && <nav
        aria-label="Filtros"
        className="border-border-default flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-[8px] border p-0.5"
      >
        {kindFilters.map((f) => {
          const selected = (f.value ?? null) === (kind ?? null)
          return (
            <Link
              key={f.label}
              href={`/mi-dinero/movimientos${kindParam(f.value)}`}
              className={cn(
                'shrink-0 rounded-[6px] px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors',
                selected
                  ? 'bg-surface-hover text-text'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover/60',
              )}
            >
              {f.label}
            </Link>
          )
        })}
      </nav>}

      {list.length === 0 ? (
        <EmptyState
          headline={
            dayFilter
              ? 'Sin movimientos ese día.'
              : kind
                ? 'No hay movimientos para este filtro.'
                : 'Sin movimientos para mostrar.'
          }
          body="Cuando importes un extracto o registres un gasto manualmente, lo verás aquí. Multi-divisa, ordenado, categorizable."
          action={<NewTransactionTrigger />}
        />
      ) : dayFilter ? (
        // Vista de un solo día (drill-in desde DayPicker): lista plana,
        // sin sticky headers porque ya hay un único día visible.
        <FlatList
          list={list}
          accounts={accounts}
          categoryOptions={categoryOptions}
        />
      ) : (
        // Vista bitácora: agrupada por día con header sticky + neto del día.
        <GroupedList
          groups={groupByDay(list, baseCurrency)}
          accounts={accounts}
          categoryOptions={categoryOptions}
        />
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

type TxItem = Awaited<ReturnType<typeof listTransactionsForUser>>[number]
type AccountBasic = Awaited<ReturnType<typeof listUserAccountsBasic>>[number]

type DayGroup = {
  day: string
  txs: TxItem[]
  netBase: number
  baseCurrency: string
}

function groupByDay(list: TxItem[], baseCurrency: string): DayGroup[] {
  const map = new Map<string, DayGroup>()
  for (const tx of list) {
    const existing = map.get(tx.date)
    const group: DayGroup =
      existing ?? { day: tx.date, txs: [], netBase: 0, baseCurrency }
    group.txs.push(tx)
    const amount = Number.parseFloat(tx.amountBase)
    if (Number.isFinite(amount)) {
      // Las transferencias no mueven el neto del día — solo recolocan
      // plata entre cuentas del mismo usuario.
      if (tx.kind === 'income') group.netBase += amount
      else if (tx.kind === 'expense') group.netBase -= amount
    }
    if (!existing) map.set(tx.date, group)
  }
  return Array.from(map.values()).sort((a, b) => b.day.localeCompare(a.day))
}

function formatDayHeader(iso: string): string {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)
  if (iso === todayIso) return 'Hoy'
  today.setUTCDate(today.getUTCDate() - 1)
  if (iso === today.toISOString().slice(0, 10)) return 'Ayer'
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

function FlatList({
  list,
  accounts,
  categoryOptions,
}: {
  list: TxItem[]
  accounts: AccountBasic[]
  categoryOptions: CategoryOption[]
}) {
  return (
    <>
      <ul className="flex flex-col gap-2 md:hidden">
        {list.map((tx) => (
          <MobileRow
            key={tx.id}
            tx={tx}
            accounts={accounts}
            categoryOptions={categoryOptions}
          />
        ))}
      </ul>
      <div className="border-border-default bg-surface hidden overflow-hidden rounded-[12px] border md:block">
        <DesktopHead />
        <div>
          {list.map((tx) => (
            <DesktopRow
              key={tx.id}
              tx={tx}
              accounts={accounts}
              categoryOptions={categoryOptions}
            />
          ))}
        </div>
      </div>
    </>
  )
}

function GroupedList({
  groups,
  accounts,
  categoryOptions,
}: {
  groups: DayGroup[]
  accounts: AccountBasic[]
  categoryOptions: CategoryOption[]
}) {
  return (
    <div className="flex flex-col gap-6">
      {/* Mobile (<md): grupos con header sticky */}
      <div className="flex flex-col gap-5 md:hidden">
        {groups.map((g) => (
          <section key={g.day} className="flex flex-col gap-2">
            <DayHeader group={g} />
            <ul className="flex flex-col gap-2">
              {g.txs.map((tx) => (
                <MobileRow
                  key={tx.id}
                  tx={tx}
                  accounts={accounts}
                  categoryOptions={categoryOptions}
                />
              ))}
            </ul>
          </section>
        ))}
      </div>
      {/* Desktop (>=md): contenedor único con headers sticky */}
      <div className="border-border-default bg-surface hidden overflow-hidden rounded-[12px] border md:block">
        <DesktopHead />
        {groups.map((g) => (
          <div key={g.day}>
            <DayHeader group={g} desktop />
            {g.txs.map((tx) => (
              <DesktopRow
                key={tx.id}
                tx={tx}
                accounts={accounts}
                categoryOptions={categoryOptions}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

function DayHeader({
  group,
  desktop = false,
}: {
  group: DayGroup
  desktop?: boolean
}) {
  const positive = group.netBase >= 0
  const label = formatDayHeader(group.day)
  const netLabel = `${positive ? '+' : '−'}${Math.abs(Math.round(group.netBase)).toLocaleString('es-CO')} ${group.baseCurrency}`
  const count = group.txs.length
  // --topbar-total = altura del topbar + safe-area-inset-top (en standalone
  // iOS la status bar suma 44–59px más). El sticky day-header se ancla por
  // debajo del topbar. En desktop la tabla además tiene su propio
  // thead sticky, así que cargamos un top mayor para no superponerlos.
  const stickyTop = desktop
    ? 'calc(var(--topbar-total) + 41px)'
    : 'var(--topbar-total)'
  return (
    <header
      className={cn(
        'sticky z-10 flex items-baseline justify-between gap-3 px-5 py-2.5',
        'backdrop-blur supports-[backdrop-filter]:bg-[color-mix(in_oklab,var(--bg)_82%,transparent)]',
        'border-border-default/60 border-b',
        !desktop &&
          'border-border-default bg-surface -mx-1 rounded-[10px] border px-4',
      )}
      style={{ top: stickyTop }}
    >
      <span className="text-text capitalize text-[13px] font-medium">
        {label}
      </span>
      <span className="flex items-baseline gap-2">
        <span
          className={cn(
            'amount tabular text-[13px]',
            positive ? 'text-positive' : 'text-negative',
          )}
        >
          {netLabel}
        </span>
        <span className="text-text-tertiary text-[11px]">
          · {count} {count === 1 ? 'mov' : 'movs'}
        </span>
      </span>
    </header>
  )
}

function DesktopHead() {
  return (
    <div
      className="border-border-default bg-surface text-text-tertiary sticky z-20 grid grid-cols-[120px_1fr_180px_180px_140px_40px] gap-x-4 border-b px-5 py-3 text-[11px] uppercase tracking-[0.08em]"
      style={{ top: 'var(--topbar-total)' }}
      role="row"
    >
      <span className="font-medium">Fecha</span>
      <span className="font-medium">Descripción</span>
      <span className="font-medium">Cuenta</span>
      <span className="font-medium">Categoría</span>
      <span className="text-right font-medium">Monto</span>
      <span aria-label="Acciones" />
    </div>
  )
}

function DesktopRow({
  tx,
  accounts,
  categoryOptions,
}: {
  tx: TxItem
  accounts: AccountBasic[]
  categoryOptions: CategoryOption[]
}) {
  return (
    <div
      className="border-border-default/60 hover:bg-surface-hover/60 grid grid-cols-[120px_1fr_180px_180px_140px_40px] items-center gap-x-4 border-b px-5 py-3.5 transition-colors last:border-b-0"
      role="row"
    >
      <span className="text-text-secondary tabular text-[13px]">
        {formatRelativeDate(tx.date)}
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-text truncate text-sm">{tx.description}</span>
        {tx.kind === 'transfer' && tx.transferAccount && (
          <span className="text-text-tertiary truncate text-[11px]">
            {tx.account.name} → {tx.transferAccount.name}
          </span>
        )}
      </div>
      <span className="text-text-secondary truncate text-sm">
        {tx.account.name}
      </span>
      <div className="min-w-0">
        <CategoryCell
          transactionId={tx.id}
          txKind={tx.kind}
          currentCategoryId={tx.category?.id ?? null}
          currentCategoryName={tx.category?.name ?? null}
          aiCategorized={tx.aiCategorized}
          aiConfidence={tx.aiConfidence}
          options={categoryOptions}
        />
      </div>
      <div className="text-right">
        <Amount
          value={tx.amountOriginal}
          currency={tx.currency}
          kind={kindToTone[tx.kind]}
          showPositiveSign={tx.kind === 'income'}
          className="text-sm"
        />
      </div>
      <div className="text-right">
        <TransactionActionsMenu
          transaction={{
            id: tx.id,
            kind: tx.kind,
            accountId: tx.account.id,
            categoryId: tx.category?.id ?? null,
            date: tx.date,
            amountOriginal: tx.amountOriginal,
            currency: tx.currency,
            description: tx.description,
            notes: tx.notes,
          }}
          accounts={accounts}
          categories={categoryOptions}
        />
      </div>
    </div>
  )
}

function MobileRow({
  tx,
  accounts,
  categoryOptions,
}: {
  tx: TxItem
  accounts: AccountBasic[]
  categoryOptions: CategoryOption[]
}) {
  return (
    <li className="border-border-default bg-surface flex min-w-0 flex-col gap-2 rounded-[12px] border p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-text truncate text-[14px]">
            {tx.description}
          </span>
          <span className="text-text-tertiary truncate text-[11px]">
            {tx.account.name}
            {tx.kind === 'transfer' && tx.transferAccount &&
              ` → ${tx.transferAccount.name}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Amount
            value={tx.amountOriginal}
            currency={tx.currency}
            kind={kindToTone[tx.kind]}
            showPositiveSign={tx.kind === 'income'}
            className="text-[14px]"
          />
          <TransactionActionsMenu
            transaction={{
              id: tx.id,
              kind: tx.kind,
              accountId: tx.account.id,
              categoryId: tx.category?.id ?? null,
              date: tx.date,
              amountOriginal: tx.amountOriginal,
              currency: tx.currency,
              description: tx.description,
              notes: tx.notes,
            }}
            accounts={accounts}
            categories={categoryOptions}
          />
        </div>
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
  )
}
