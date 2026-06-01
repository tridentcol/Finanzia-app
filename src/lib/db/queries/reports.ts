import 'server-only'
import { and, desc, eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { monthlyReports } from '@/lib/db/schema'
import { userDataTag } from '@/lib/cache/data'
import { getExpensesByParentCategory } from '@/lib/db/queries/expenses-by-parent'
import { listInsightsForUser } from '@/lib/db/queries/insights'
import type { CurrencyCode } from '@/lib/currency/currencies'

/**
 * Lista de informes mensuales para /mi-historia/informes, cacheada
 * cross-request (unstable_cache). Los informes los genera el cron del primer
 * día del mes; el tag coarse `data:${userId}` lo bustea cualquier Server Action
 * que muta y `revalidate: 30` acota la frescura frente al cron.
 */
export function getInformesData(userId: string) {
  return unstable_cache(
    () =>
      db
        .select({
          id: monthlyReports.id,
          period: monthlyReports.period,
          totalIncome: monthlyReports.totalIncome,
          totalExpense: monthlyReports.totalExpense,
          netSavings: monthlyReports.netSavings,
          aiSummary: monthlyReports.aiSummary,
        })
        .from(monthlyReports)
        .where(eq(monthlyReports.userId, userId))
        .orderBy(desc(monthlyReports.period)),
    ['informes-data', userId],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}

/**
 * Detalle de un informe mensual para /mi-historia/informes/[period], cacheado
 * cross-request: el informe en sí, el desglose por categoría padre y los
 * insights de ese mes. `report` puede ser null (período sin informe). La key
 * incluye period y currency; el tag coarse `data:${userId}` lo bustea cualquier
 * Server Action que muta. `revalidate: 30` es un backstop.
 */
export function getInformeData(
  userId: string,
  period: string,
  currency: CurrencyCode,
) {
  return unstable_cache(
    async () => {
      const [report, expensesByParent, monthInsights] = await Promise.all([
        db.query.monthlyReports.findFirst({
          where: and(
            eq(monthlyReports.userId, userId),
            eq(monthlyReports.period, period),
          ),
        }),
        getExpensesByParentCategory(userId, currency, { month: period }),
        listInsightsForUser(userId, { includeDismissed: false, limit: 50 }),
      ])

      // Insights cuyo periodEnd cae dentro de este `period`.
      const insightsOfMonth = monthInsights.filter((ins) => {
        const bucket = (
          ins.periodEnd ?? ins.createdAt.toISOString().slice(0, 10)
        ).slice(0, 7)
        return bucket === period
      })

      return { report: report ?? null, expensesByParent, insightsOfMonth }
    },
    ['informe-detail', userId, period, currency],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
