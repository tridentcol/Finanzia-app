import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireCurrentUser } from '@/lib/auth'
import { getCuentaDetailData } from '@/lib/db/queries/account-detail'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import { NewTransactionTrigger } from '@/components/app/new-transaction-trigger'
import { TransactionActionsMenu } from '@/components/app/transaction-actions-menu'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

const kindToTone = {
  income: 'positive',
  expense: 'negative',
  transfer: 'neutral',
} as const

function formatRelativeDate(iso: string): string {
  const date = new Date(`${iso}T00:00:00Z`)
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    timeZone: 'UTC',
  }).format(date)
}

export default async function CuentaDetailPage({ params }: Props) {
  const { id } = await params
  const user = await requireCurrentUser()
  const { account, recent, available, accountsBasic } =
    await getCuentaDetailData(user.id, id)

  if (!account) notFound()

  // Las tarjetas viven en /mi-dinero/tarjetas — su detalle también.
  if (account.type === 'credit_card') {
    redirect(`/mi-dinero/tarjetas/${id}`)
  }

  const balance = Number.parseFloat(account.currentBalance)

  const categoryOptions = available.map((c) => ({
    id: c.id,
    name: c.name,
    kind: c.kind,
    parentId: c.parentId,
  }))

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <Link
          href="/mi-dinero/cuentas"
          className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
        >
          ← Cuentas
        </Link>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          {account.name}
        </h1>
        <Amount
          value={account.currentBalance}
          currency={account.currency}
          display
          kind={balance < 0 ? 'negative' : 'neutral'}
          className="mt-2 block truncate text-[28px] sm:text-4xl md:text-5xl lg:text-6xl"
        />
        <p className="text-text-tertiary text-xs">
          Saldo actual · {account.currency}
        </p>
      </header>

      <section className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-text text-sm font-semibold">
            Movimientos recientes
          </h2>
          <Link
            href={`/mi-dinero/movimientos?accountId=${account.id}`}
            className="text-text-secondary hover:text-text text-[13px] transition-colors"
          >
            Ver todos
          </Link>
        </header>

        {recent.length === 0 ? (
          <EmptyState
            headline="Aún no hay movimientos en esta cuenta."
            body="Registra el primero y aparecerá acá ordenado por fecha."
            action={<NewTransactionTrigger label="Registrar movimiento" />}
          />
        ) : (
          <ul className="border-border-default bg-surface flex flex-col rounded-[12px] border">
            {recent.map((tx, idx) => (
              <li
                key={tx.id}
                className={`flex items-center justify-between gap-4 px-5 py-3 ${
                  idx !== recent.length - 1
                    ? 'border-border-default/60 border-b'
                    : ''
                }`}
              >
                <div className="flex min-w-0 flex-col">
                  <span className="text-text truncate text-sm">
                    {tx.description}
                  </span>
                  <span className="text-text-tertiary text-[11px]">
                    {formatRelativeDate(tx.date)}
                    {tx.category && ` · ${tx.category.name}`}
                    {tx.kind === 'transfer' && tx.transferAccount && (
                      <>
                        {' '}
                        →{' '}
                        <span className="text-text-secondary">
                          {tx.transferAccount.name}
                        </span>
                      </>
                    )}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Amount
                    value={tx.amountOriginal}
                    currency={tx.currency}
                    kind={kindToTone[tx.kind]}
                    showPositiveSign={tx.kind === 'income'}
                    className="text-sm"
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
                    accounts={accountsBasic}
                    categories={categoryOptions}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
