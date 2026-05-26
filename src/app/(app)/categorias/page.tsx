import type { Metadata } from 'next'
import Link from 'next/link'
import { and, asc, eq, isNull, or } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { categories } from '@/lib/db/schema'
import { NewCategoryTrigger } from '@/components/app/new-category-trigger'
import { CategoryActionsMenu } from '@/components/app/category-actions-menu'
import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

export const metadata: Metadata = {
  title: 'Categorías',
}

type SearchParams = Promise<{ kind?: string }>

const kindFilters: Array<{ value: 'expense' | 'income' | 'transfer' | null; label: string }> = [
  { value: null, label: 'Todas' },
  { value: 'expense', label: 'Gastos' },
  { value: 'income', label: 'Ingresos' },
  { value: 'transfer', label: 'Transferencias' },
]

function kindParam(value: 'expense' | 'income' | 'transfer' | null): string {
  return value ? `?kind=${value}` : ''
}

function labelForKind(kind: 'income' | 'expense' | 'transfer'): string {
  if (kind === 'income') return 'Ingreso'
  if (kind === 'expense') return 'Gasto'
  return 'Transferencia'
}

export default async function CategoriasPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const user = await requireCurrentUser()
  const params = await searchParams

  const kindFilter =
    params.kind === 'income' || params.kind === 'expense' || params.kind === 'transfer'
      ? params.kind
      : null

  const rows = await db
    .select({
      id: categories.id,
      userId: categories.userId,
      parentId: categories.parentId,
      name: categories.name,
      kind: categories.kind,
      icon: categories.icon,
      color: categories.color,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(
      and(
        or(isNull(categories.userId), eq(categories.userId, user.id)),
        eq(categories.archived, false),
        kindFilter ? eq(categories.kind, kindFilter) : undefined,
      ),
    )
    .orderBy(asc(categories.kind), asc(categories.sortOrder), asc(categories.name))

  const parents = rows.filter((c) => c.parentId === null)
  const childrenByParent = new Map<string, typeof rows>()
  for (const c of rows) {
    if (!c.parentId) continue
    const list = childrenByParent.get(c.parentId) ?? []
    list.push(c)
    childrenByParent.set(c.parentId, list)
  }

  // Categorías padre del usuario primero, luego sistema. Dentro de cada grupo: por kind y nombre.
  const sortedParents = [...parents].sort((a, b) => {
    const aOwn = a.userId !== null ? 0 : 1
    const bOwn = b.userId !== null ? 0 : 1
    if (aOwn !== bOwn) return aOwn - bOwn
    if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
    return a.sortOrder - b.sortOrder
  })

  const userCount = parents.filter((p) => p.userId !== null).length
  const totalUserChildren = rows.filter((r) => r.userId !== null && r.parentId !== null).length

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-text-secondary text-sm">Categorías</p>
          <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
            Sistema y propias
          </h1>
          <p className="text-text-tertiary mt-1 text-xs">
            {userCount + totalUserChildren > 0
              ? `${userCount + totalUserChildren} tuyas · ${parents.length - userCount} del sistema`
              : `${parents.length} categorías del sistema`}
          </p>
        </div>
        <NewCategoryTrigger />
      </header>

      <nav
        aria-label="Filtros"
        className="border-border-default -mx-1 flex items-center gap-1 overflow-x-auto rounded-[8px] border p-0.5 self-start"
      >
        {kindFilters.map((f) => {
          const selected = (f.value ?? null) === (kindFilter ?? null)
          return (
            <Link
              key={f.label}
              href={`/categorias${kindParam(f.value)}`}
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

      {parents.length === 0 ? (
        <p className="text-text-tertiary text-sm">Sin categorías para mostrar.</p>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {sortedParents.map((p) => {
            const iconName = (p.icon ?? 'tag') as IconName
            const Icon = icons[iconName] ?? icons.tag
            const children = childrenByParent.get(p.id) ?? []
            const isOwn = p.userId !== null
            return (
              <li key={p.id} className="min-w-0">
                <article className="border-border-default bg-surface flex min-w-0 flex-col gap-3 rounded-[12px] border p-5">
                  <header className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span
                        className="border-border-default flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] border"
                        style={p.color ? { color: p.color } : undefined}
                      >
                        <Icon strokeWidth={1.5} className="h-4 w-4" />
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-text truncate text-sm font-semibold">
                            {p.name}
                          </span>
                          {isOwn && (
                            <span className="border-border-emphasis text-text-secondary shrink-0 rounded-[4px] border px-1.5 py-0 text-[10px] uppercase tracking-wider">
                              Tuya
                            </span>
                          )}
                        </div>
                        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                          {labelForKind(p.kind)}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {!isOwn && (
                        <span className="text-text-tertiary border-border-default rounded-[4px] border px-1.5 py-0.5 text-[10px] uppercase tracking-wider">
                          Sistema
                        </span>
                      )}
                      {isOwn && (
                        <CategoryActionsMenu
                          categoryId={p.id}
                          categoryName={p.name}
                        />
                      )}
                    </div>
                  </header>
                  {children.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5">
                      {children.map((c) => {
                        const cIsOwn = c.userId !== null
                        return (
                          <li
                            key={c.id}
                            className={cn(
                              'flex items-center gap-1 rounded-[4px] border px-2 py-0.5 text-[12px]',
                              cIsOwn
                                ? 'border-border-emphasis text-text bg-surface-hover/30'
                                : 'border-border-default text-text-secondary',
                            )}
                          >
                            {c.name}
                            {cIsOwn && (
                              <CategoryActionsMenu
                                categoryId={c.id}
                                categoryName={c.name}
                              />
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </article>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
