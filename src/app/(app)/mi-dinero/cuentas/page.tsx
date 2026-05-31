import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import {
  getTotalBalanceInBase,
  listAccountsWithBalance,
} from '@/lib/db/queries/accounts'
import { EmptyState } from '@/components/app/empty-state'
import { Amount } from '@/components/app/amount'
import { NewAccountTrigger } from '@/components/app/new-account-trigger'
import { icons, type IconName } from '@/lib/design/icons'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Cuentas',
}

const typeMeta: Record<
  | 'checking'
  | 'savings'
  | 'cash'
  | 'investment'
  | 'crypto'
  | 'other',
  { label: string; icon: IconName }
> = {
  checking: { label: 'Cuenta corriente', icon: 'landmark' },
  savings: { label: 'Ahorros', icon: 'piggy-bank' },
  cash: { label: 'Efectivo', icon: 'banknote' },
  investment: { label: 'Inversión', icon: 'trending-up' },
  crypto: { label: 'Cripto', icon: 'bitcoin' },
  other: { label: 'Otra', icon: 'circle' },
}

export default async function CuentasPage() {
  const user = await requireCurrentUser()
  const profile = await getProfile(user.id)
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const accountsList = await listAccountsWithBalance(user.id)

  // Tarjetas viven en /mi-dinero/tarjetas. Aquí sólo cuentas líquidas y activos.
  const ownedAccounts = accountsList.filter((a) => a.type !== 'credit_card')

  // Suma de saldos de cuentas en moneda base. El patrimonio neto (activos −
  // tarjetas − deudas) vive en Cash flow, donde el balance global tiene
  // contexto y proyección.
  const { total: totalBase, partial: totalPartial } = await getTotalBalanceInBase(
    user.id,
    baseCurrency,
    ownedAccounts,
  )

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <p className="text-text-secondary text-sm">Saldo en cuentas</p>
          <Amount
            value={totalBase}
            currency={baseCurrency}
            display
            kind={parseFloat(totalBase) < 0 ? 'negative' : 'neutral'}
            className="block truncate text-[28px] sm:text-4xl md:text-5xl"
          />
          <p className="text-text-tertiary text-xs">
            {ownedAccounts.length}{' '}
            {ownedAccounts.length === 1 ? 'cuenta' : 'cuentas'} ·{' '}
            {baseCurrency}
            {totalPartial && ' · conversión parcial'}
          </p>
        </div>
        <NewAccountTrigger />
      </header>

      {ownedAccounts.length === 0 ? (
        <EmptyState
          headline="Todavía no hay cuentas registradas."
          body="Las cuentas son la base de Finanzia: corrientes, ahorros, efectivo, inversiones. Empieza por una — siempre se pueden agregar más. Las tarjetas viven en su propia pestaña."
          action={<NewAccountTrigger />}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {ownedAccounts.map((a) => {
            const meta = typeMeta[a.type as keyof typeof typeMeta]
            const Icon = icons[a.icon as IconName] ?? icons[meta.icon]
            return (
              <li key={a.id} className="min-w-0">
                <article className="border-border-default bg-surface flex min-w-0 flex-col gap-5 rounded-[12px] border p-5">
                  <header className="flex items-start justify-between gap-3">
                    <Link
                      href={`/mi-dinero/cuentas/${a.id}`}
                      className="flex min-w-0 items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <span
                        className="border-border-default flex h-9 w-9 shrink-0 items-center justify-center rounded-md border"
                        style={a.color ? { color: a.color } : undefined}
                      >
                        <Icon strokeWidth={1.5} className="h-4 w-4" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="text-text truncate text-sm font-semibold">
                          {a.name}
                        </span>
                        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                          {meta.label}
                        </span>
                      </div>
                    </Link>
                    <span className="text-text-tertiary shrink-0 text-[11px] tracking-wider">
                      {a.currency}
                    </span>
                  </header>

                  <div className="flex flex-col gap-1">
                    <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                      Saldo actual
                    </span>
                    <Amount
                      value={a.currentBalance}
                      currency={a.currency}
                      kind={parseFloat(a.currentBalance) < 0 ? 'negative' : 'neutral'}
                      className="text-2xl"
                    />
                  </div>
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
