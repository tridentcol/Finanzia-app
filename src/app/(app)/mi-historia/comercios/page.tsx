import type { Metadata } from 'next'
import Link from 'next/link'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import {
  getComerciosData,
  resolveRange,
  type MerchantRow,
  type MerchantsRange,
} from '@/lib/db/queries/merchants'
import { Amount } from '@/components/app/amount'
import { EmptyState } from '@/components/app/empty-state'
import { formatMoney } from '@/lib/currency/format'
import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'
import type { CurrencyCode } from '@/lib/currency/currencies'

export const metadata: Metadata = {
  title: 'Comercios',
}

type SearchParams = Promise<{ scope?: string }>

const SCOPES: Array<{ value: MerchantsRange['scope']; label: string }> = [
  { value: 'this-month', label: 'Este mes' },
  { value: 'this-year', label: 'Este año' },
]

function isScope(v: string | undefined): v is MerchantsRange['scope'] {
  return v === 'this-month' || v === 'this-year'
}

const UNCATEGORIZED_KEY = '__uncategorized__'

type MerchantGroup = {
  key: string
  categoryName: string
  categoryColor: string | null
  categoryIcon: string | null
  total: number
  merchants: MerchantRow[]
}

function groupByCategory(merchants: MerchantRow[]): MerchantGroup[] {
  const map = new Map<string, MerchantGroup>()
  for (const m of merchants) {
    const key = m.categoryName ?? UNCATEGORIZED_KEY
    const existing = map.get(key)
    if (existing) {
      existing.total += Number.parseFloat(m.totalBase)
      existing.merchants.push(m)
    } else {
      map.set(key, {
        key,
        categoryName: m.categoryName ?? 'Sin categoría',
        categoryColor: m.categoryColor,
        categoryIcon: m.categoryIcon,
        total: Number.parseFloat(m.totalBase),
        merchants: [m],
      })
    }
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total)
}

export default async function ComerciosPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  const params = await searchParams
  const scope = isScope(params.scope) ? params.scope : 'this-month'
  const range = resolveRange(scope)
  const today = new Date().toISOString().slice(0, 10)

  const [profile, merchants] = await Promise.all([
    getProfile(user.id),
    getComerciosData(user.id, scope, today),
  ])
  const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode

  const grandTotal = merchants.reduce(
    (acc, m) => acc + Number.parseFloat(m.totalBase),
    0,
  )
  const groups = groupByCategory(merchants)
  const maxGroupTotal = Math.max(1, ...groups.map((g) => g.total))

  return (
    <div className="flex min-w-0 flex-col gap-10 lg:gap-12">
      <header className="flex min-w-0 flex-col gap-1.5">
        <p className="text-text-secondary text-sm">Comercios</p>
        <h1 className="editorial text-text text-3xl italic capitalize sm:text-4xl">
          Dónde se fue tu dinero
        </h1>
        <p className="text-text-tertiary mt-1 max-w-prose text-[13px]">
          Agrupado por categoría — los comercios de cada categoría suman al
          total. Click en un comercio para ver sus transacciones.
        </p>
      </header>

      <nav
        aria-label="Período"
        className="border-border-default flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-[8px] border p-0.5"
      >
        {SCOPES.map((s) => {
          const selected = s.value === scope
          return (
            <Link
              key={s.value}
              href={`/mi-historia/comercios?scope=${s.value}`}
              className={cn(
                'shrink-0 rounded-[6px] px-3 py-1.5 text-[13px] whitespace-nowrap transition-colors',
                selected
                  ? 'bg-surface-hover text-text'
                  : 'text-text-secondary hover:text-text hover:bg-surface-hover/60',
              )}
            >
              {s.label}
            </Link>
          )
        })}
      </nav>

      {merchants.length === 0 ? (
        <EmptyState
          headline="No hay gastos en este período todavía."
          body={`Cuando registres movimientos en ${range.label.toLowerCase()}, aparecerán agrupados por comercio acá.`}
        />
      ) : (
        <>
          <div className="border-border-default bg-surface flex flex-wrap items-center justify-between gap-3 rounded-[12px] border p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                Total · {range.label}
              </span>
              <Amount
                value={grandTotal.toFixed(2)}
                currency={baseCurrency}
                kind="neutral"
                className="text-2xl"
              />
            </div>
            <div className="flex flex-col items-end gap-0.5 text-[12px]">
              <span className="text-text-secondary tabular">
                {merchants.length}{' '}
                {merchants.length === 1 ? 'comercio' : 'comercios'}
              </span>
              <span className="text-text-tertiary">
                en {groups.length}{' '}
                {groups.length === 1 ? 'categoría' : 'categorías'}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            {groups.map((group) => {
              const groupSharePct =
                grandTotal > 0
                  ? Math.round((group.total / grandTotal) * 100)
                  : 0
              const groupWidthPct = Math.max(
                2,
                (group.total / maxGroupTotal) * 100,
              )
              const iconKey =
                group.categoryIcon && group.categoryIcon in icons
                  ? (group.categoryIcon as IconName)
                  : 'tag'
              const Icon = icons[iconKey]
              return (
                <section
                  key={group.key}
                  className="border-border-default bg-surface flex min-w-0 flex-col gap-4 rounded-[12px] border p-5"
                >
                  <header className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="border-border-default flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border"
                          style={
                            group.categoryColor
                              ? { color: group.categoryColor }
                              : undefined
                          }
                        >
                          <Icon strokeWidth={1.5} className="h-4 w-4" />
                        </span>
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="text-text truncate text-sm font-semibold">
                            {group.categoryName}
                          </span>
                          <span className="text-text-tertiary text-[11px]">
                            {group.merchants.length}{' '}
                            {group.merchants.length === 1
                              ? 'comercio'
                              : 'comercios'}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-0.5">
                        <span className="text-text amount tabular text-base">
                          {formatMoney(group.total, {
                            currency: baseCurrency,
                            compact: true,
                          })}
                        </span>
                        <span className="text-text-tertiary text-[11px] tabular">
                          {groupSharePct}% del total
                        </span>
                      </div>
                    </div>
                    <div className="bg-surface-hover h-1 overflow-hidden rounded-full">
                      <div
                        aria-hidden
                        className="h-full rounded-full"
                        style={{
                          width: `${groupWidthPct}%`,
                          background: 'var(--purple-base)',
                        }}
                      />
                    </div>
                  </header>

                  <ul className="border-border-default/40 flex flex-col border-t">
                    {group.merchants
                      .sort(
                        (a, b) =>
                          Number.parseFloat(b.totalBase) -
                          Number.parseFloat(a.totalBase),
                      )
                      .map((m) => {
                        const amount = Number.parseFloat(m.totalBase)
                        const mSharePct =
                          group.total > 0
                            ? Math.round((amount / group.total) * 100)
                            : 0
                        return (
                          <li
                            key={m.slug}
                            className="border-border-default/40 border-b last:border-b-0"
                          >
                            <Link
                              href={`/mi-dinero/movimientos?merchant=${encodeURIComponent(m.slug)}`}
                              className="hover:bg-surface-hover/40 flex items-center justify-between gap-4 py-2.5 transition-colors"
                            >
                              <div className="flex min-w-0 flex-col gap-0.5">
                                <span className="text-text truncate text-[13px] capitalize">
                                  {m.name}
                                </span>
                                <span className="text-text-tertiary text-[11px]">
                                  {m.count}{' '}
                                  {m.count === 1 ? 'movimiento' : 'movimientos'}
                                </span>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-0.5">
                                <span className="text-text amount tabular text-[13px]">
                                  {formatMoney(amount, {
                                    currency: baseCurrency,
                                    compact: true,
                                  })}
                                </span>
                                <span className="text-text-tertiary text-[11px] tabular">
                                  {mSharePct}%
                                </span>
                              </div>
                            </Link>
                          </li>
                        )
                      })}
                  </ul>
                </section>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
