import 'server-only'
import { and, desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { accounts, categories, recurringRules } from '@/lib/db/schema'

export type RecurringRuleListItem = {
  id: string
  description: string
  amount: string
  currency: string
  kind: 'income' | 'expense' | 'transfer'
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'
  dayOfMonth: number | null
  dayOfWeek: number | null
  nextRun: string | null
  lastRun: string | null
  active: boolean
  autoCreate: boolean
  accountId: string
  accountName: string | null
  categoryId: string | null
  categoryName: string | null
}

export async function listRecurringForUser(
  userId: string,
): Promise<RecurringRuleListItem[]> {
  const rows = await db
    .select({
      id: recurringRules.id,
      description: recurringRules.description,
      amount: recurringRules.amount,
      currency: recurringRules.currency,
      kind: recurringRules.kind,
      frequency: recurringRules.frequency,
      dayOfMonth: recurringRules.dayOfMonth,
      dayOfWeek: recurringRules.dayOfWeek,
      nextRun: recurringRules.nextRun,
      lastRun: recurringRules.lastRun,
      active: recurringRules.active,
      autoCreate: recurringRules.autoCreate,
      accountId: recurringRules.accountId,
      accountName: accounts.name,
      categoryId: recurringRules.categoryId,
      categoryName: categories.name,
    })
    .from(recurringRules)
    .leftJoin(accounts, eq(accounts.id, recurringRules.accountId))
    .leftJoin(categories, eq(categories.id, recurringRules.categoryId))
    .where(and(eq(recurringRules.userId, userId)))
    .orderBy(desc(recurringRules.active), recurringRules.nextRun)

  return rows
}
