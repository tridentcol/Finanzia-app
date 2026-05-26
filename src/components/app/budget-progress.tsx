import { cn } from '@/lib/utils'
import { Amount } from './amount'
import { icons, type IconName } from '@/lib/design/icons'
import type { BudgetProgress as BudgetProgressType } from '@/lib/db/queries/budgets'
import type { CurrencyCode } from '@/lib/currency/currencies'

const statusToFill = {
  safe: 'bg-text-tertiary',
  warning: 'bg-warning',
  exceeded: 'bg-negative',
} as const

const periodLabel = {
  monthly: 'este mes',
  weekly: 'esta semana',
  yearly: 'este año',
} as const

export function BudgetProgressCard({
  budget,
  currency,
  compact = false,
}: {
  budget: BudgetProgressType
  currency: CurrencyCode
  compact?: boolean
}) {
  const iconName = (budget.categoryIcon ?? 'tag') as IconName
  const Icon = icons[iconName] ?? icons.tag
  const fillWidth = `${Math.min(100, budget.percent * 100)}%`
  const status = budget.status

  return (
    <article
      className={cn(
        'border-border-default bg-surface flex min-w-0 flex-col gap-4 rounded-[12px] border',
        compact ? 'p-4' : 'p-5',
      )}
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className="border-border-default flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border"
            style={budget.categoryColor ? { color: budget.categoryColor } : undefined}
          >
            <Icon strokeWidth={1.5} className="h-4 w-4" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="text-text truncate text-sm font-semibold">
              {budget.categoryName}
            </span>
            <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              {periodLabel[budget.period]}
            </span>
          </div>
        </div>
        <div className="shrink-0">
          <StatusBadge status={status} />
        </div>
      </header>

      <div className="flex flex-col gap-2">
        <div className="bg-surface-hover relative h-1.5 w-full overflow-hidden rounded-full">
          <div
            className={cn('h-full transition-[width] duration-500', statusToFill[status])}
            style={{ width: fillWidth }}
          />
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <Amount
            value={budget.spent}
            currency={currency}
            className="text-text text-sm"
          />
          <span className="text-text-tertiary text-xs">
            de <Amount value={budget.amount} currency={currency} className="text-xs" />
          </span>
        </div>
      </div>
    </article>
  )
}

function StatusBadge({ status }: { status: BudgetProgressType['status'] }) {
  if (status === 'safe') return null
  const label = status === 'warning' ? 'Cerca del tope' : 'Excedido'
  const tone =
    status === 'warning'
      ? 'text-warning border-warning/40'
      : 'text-negative border-negative/40'
  return (
    <span
      className={cn(
        'rounded-[4px] border px-1.5 py-0.5 text-[10px] uppercase tracking-wider',
        tone,
      )}
    >
      {label}
    </span>
  )
}
