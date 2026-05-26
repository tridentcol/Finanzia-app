import type { Metadata } from 'next'
import { and, eq, isNull, asc } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { categories } from '@/lib/db/schema'

export const metadata: Metadata = {
  title: 'Categorías',
}

export default async function CategoriasPage() {
  const parents = await db
    .select({
      id: categories.id,
      name: categories.name,
      kind: categories.kind,
      icon: categories.icon,
    })
    .from(categories)
    .where(and(isNull(categories.userId), isNull(categories.parentId)))
    .orderBy(asc(categories.sortOrder))

  const childrenByParent = await db
    .select({
      id: categories.id,
      name: categories.name,
      parentId: categories.parentId,
    })
    .from(categories)
    .where(and(isNull(categories.userId), eq(categories.archived, false)))
    .orderBy(asc(categories.sortOrder))

  const childMap = new Map<string, { id: string; name: string }[]>()
  for (const c of childrenByParent) {
    if (!c.parentId) continue
    const list = childMap.get(c.parentId) ?? []
    list.push({ id: c.id, name: c.name })
    childMap.set(c.parentId, list)
  }

  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm">Categorías</p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.02em]">
          Sistema base
        </h1>
        <p className="text-text-tertiary mt-2 max-w-xl text-sm leading-relaxed">
          Estas son las categorías sembradas por Finanzia. Podrás crear las
          tuyas y editar las existentes en pasos posteriores.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {parents.map((p) => (
          <article
            key={p.id}
            className="border-border-default bg-surface rounded-[12px] border p-5"
          >
            <header className="flex items-baseline justify-between gap-4">
              <h2 className="text-text text-sm font-semibold">{p.name}</h2>
              <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
                {labelForKind(p.kind)}
              </span>
            </header>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {(childMap.get(p.id) ?? []).map((c) => (
                <li
                  key={c.id}
                  className="border-border-default text-text-secondary rounded-[4px] border px-2 py-0.5 text-[12px]"
                >
                  {c.name}
                </li>
              ))}
              {!childMap.get(p.id)?.length && (
                <li className="text-text-tertiary text-[12px]">Sin subcategorías</li>
              )}
            </ul>
          </article>
        ))}
      </div>
    </div>
  )
}

function labelForKind(kind: 'income' | 'expense' | 'transfer'): string {
  if (kind === 'income') return 'Ingreso'
  if (kind === 'expense') return 'Gasto'
  return 'Transferencia'
}
