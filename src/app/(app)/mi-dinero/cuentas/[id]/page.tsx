import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'

import { requireCurrentUser } from '@/lib/auth'
import { getAccountById } from '@/lib/db/queries/accounts'
import { Amount } from '@/components/app/amount'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  return { title: id }
}

export default async function CuentaDetailPage({ params }: Props) {
  const { id } = await params
  const user = await requireCurrentUser()
  const account = await getAccountById(user.id, id)

  if (!account) notFound()

  // Las tarjetas viven en /mi-dinero/tarjetas — su detalle también.
  if (account.type === 'credit_card') {
    redirect(`/mi-dinero/tarjetas/${id}`)
  }

  const balance = Number.parseFloat(account.currentBalance)

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
    </div>
  )
}
