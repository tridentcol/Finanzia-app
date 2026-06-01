import 'server-only'
import { sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { userDataTag } from '@/lib/cache/data'

export type BudgetProgress = {
  id: string
  categoryId: string
  categoryName: string
  categoryIcon: string | null
  categoryColor: string | null
  amount: string
  period: 'monthly' | 'weekly' | 'yearly'
  rollover: boolean
  periodStart: string
  periodEnd: string
  spent: string
  /** Porcentaje 0..1+ (puede pasar de 1 si se excedió). */
  percent: number
  status: 'safe' | 'warning' | 'exceeded'
}

/**
 * Devuelve presupuestos activos del usuario con el gasto del período en curso.
 *
 * `period` se resuelve con `date_trunc` de Postgres, lo cual respeta ISO week
 * (lunes) para 'weekly'. Las transacciones se filtran por `category_id` exacto
 * (no jerarquía — un presupuesto sobre "Transporte" no agrega "Combustible";
 * para presupuestos jerárquicos crear el padre como categoría aparte).
 */
export async function listBudgetsWithProgress(
  userId: string,
): Promise<BudgetProgress[]> {
  const rows = await db.execute<{
    id: string
    category_id: string
    category_name: string
    category_icon: string | null
    category_color: string | null
    amount: string
    period: BudgetProgress['period']
    rollover: boolean
    /** Postgres `date` columns vienen como string 'YYYY-MM-DD' desde postgres-js. */
    period_start: string
    period_end: string
    spent: string
  }>(sql`
    WITH ranges AS (
      SELECT
        b.id,
        b.category_id,
        c.name AS category_name,
        c.icon AS category_icon,
        c.color AS category_color,
        b.amount::text AS amount,
        b.period,
        b.rollover,
        CASE b.period
          WHEN 'monthly' THEN date_trunc('month', CURRENT_DATE)::date
          WHEN 'weekly'  THEN date_trunc('week',  CURRENT_DATE)::date
          WHEN 'yearly'  THEN date_trunc('year',  CURRENT_DATE)::date
        END AS period_start,
        CASE b.period
          WHEN 'monthly' THEN (date_trunc('month', CURRENT_DATE) + interval '1 month - 1 day')::date
          WHEN 'weekly'  THEN (date_trunc('week',  CURRENT_DATE) + interval '6 days')::date
          WHEN 'yearly'  THEN (date_trunc('year',  CURRENT_DATE) + interval '1 year - 1 day')::date
        END AS period_end
      FROM budgets b
      JOIN categories c ON c.id = b.category_id
      WHERE b.user_id = ${userId}
        AND b.archived = false
    )
    SELECT
      r.*,
      COALESCE((
        SELECT SUM(t.amount_base)::text
        FROM transactions t
        WHERE t.user_id = ${userId}
          AND t.category_id = r.category_id
          AND t.kind = 'expense'
          AND t.deleted_at IS NULL
          AND t.date >= r.period_start
          AND t.date <= r.period_end
      ), '0') AS spent
    FROM ranges r
    ORDER BY r.category_name
  `)

  return rows.map((row) => {
    const amount = Number.parseFloat(row.amount)
    const spent = Number.parseFloat(row.spent)
    const percent = amount > 0 ? spent / amount : 0
    let status: BudgetProgress['status'] = 'safe'
    if (percent >= 1) status = 'exceeded'
    else if (percent >= 0.8) status = 'warning'

    return {
      id: row.id,
      categoryId: row.category_id,
      categoryName: row.category_name,
      categoryIcon: row.category_icon,
      categoryColor: row.category_color,
      amount: row.amount,
      period: row.period,
      rollover: row.rollover,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      spent: row.spent,
      percent,
      status,
    }
  })
}

/**
 * Datos de /mi-plan/presupuestos cacheados cross-request (unstable_cache). El
 * gasto consumido se computa contra el mes actual (CURRENT_DATE en SQL), por
 * eso la key incluye `today`: al cambiar de mes la entrada se refresca. El tag
 * coarse `data:${userId}` lo bustea cualquier Server Action que muta.
 * `revalidate: 30` es un backstop.
 */
export function getPresupuestosData(userId: string, today: string) {
  return unstable_cache(
    () => listBudgetsWithProgress(userId),
    ['presupuestos-data', userId, today],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
