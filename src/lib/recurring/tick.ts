import 'server-only'
import { and, eq, lte } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { accounts, alerts, profiles, recurringRules, transactions } from '@/lib/db/schema'
import { convertAmount } from '@/lib/currency/rates'

/**
 * Avanza `next_run` de una rule según su frequency. Reglas dom-mes y dom-sem
 * preservan el día configurado cuando es posible. Si no se especifica
 * day_of_month / day_of_week, se usa el día actual.
 */
export function advanceNextRun(
  currentNextRun: string,
  frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly',
): string {
  const d = new Date(`${currentNextRun}T00:00:00Z`)
  switch (frequency) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1)
      break
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7)
      break
    case 'biweekly':
      d.setUTCDate(d.getUTCDate() + 14)
      break
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1)
      break
    case 'quarterly':
      d.setUTCMonth(d.getUTCMonth() + 3)
      break
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1)
      break
  }
  return d.toISOString().slice(0, 10)
}

type TickResult = {
  ruleId: string
  created: boolean
  skipped: 'auto_create_off' | 'no_account' | 'insert_failed' | null
}

/**
 * Tick: ejecuta UNA rule cuando su next_run <= today. Si `autoCreate`,
 * inserta la transacción y avanza next_run. Si no, sólo crea una alert tipo
 * `recurring_due` para que el usuario la registre manualmente.
 */
export async function tickRule(
  ruleId: string,
  todayIso: string,
): Promise<TickResult> {
  const rule = await db.query.recurringRules.findFirst({
    where: and(eq(recurringRules.id, ruleId), eq(recurringRules.active, true)),
  })
  if (!rule) return { ruleId, created: false, skipped: 'no_account' }
  if (!rule.nextRun || rule.nextRun > todayIso) {
    return { ruleId, created: false, skipped: null }
  }

  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, rule.accountId), eq(accounts.archived, false)),
  })
  if (!account) {
    return { ruleId, created: false, skipped: 'no_account' }
  }

  if (!rule.autoCreate) {
    // No mutamos — sólo notificamos.
    await db.insert(alerts).values({
      userId: rule.userId,
      kind: 'recurring_due',
      refId: rule.id,
      message: `${rule.description} (${rule.amount} ${rule.currency}) vence hoy. Registrala cuando confirmes.`,
    })
    return { ruleId, created: false, skipped: 'auto_create_off' }
  }

  // Conversión amount → base.
  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, rule.userId),
  })
  const baseCurrency = profile?.baseCurrency ?? 'COP'
  const conv = await convertAmount(rule.amount, rule.currency, baseCurrency, rule.nextRun, {
    fallbackToOne: true,
  })

  const [inserted] = await db
    .insert(transactions)
    .values({
      userId: rule.userId,
      accountId: rule.accountId,
      categoryId: rule.categoryId,
      date: rule.nextRun,
      amountOriginal: rule.amount,
      currency: rule.currency,
      amountBase: conv.amount,
      // Sin tasa (camino automatizado, sin UI para rechazar): provisional con
      // exchange_rate=NULL para backfill, igual que el webhook — en vez de un
      // 1:1 silencioso que distorsiona la base (regla #4).
      exchangeRate: conv.missing ? null : conv.rate,
      description: rule.description,
      kind: rule.kind,
      recurringRuleId: rule.id,
    })
    .returning({ id: transactions.id })

  if (!inserted) {
    return { ruleId, created: false, skipped: 'insert_failed' }
  }

  await db
    .update(recurringRules)
    .set({
      lastRun: rule.nextRun,
      nextRun: advanceNextRun(rule.nextRun, rule.frequency),
    })
    .where(eq(recurringRules.id, rule.id))

  return { ruleId, created: true, skipped: null }
}

/**
 * Procesa todas las rules elegibles del usuario para el día dado.
 * Catch-up: si una rule lleva varios períodos atrasados (cron caído), se
 * ejecuta repetidamente hasta alcanzar today.
 */
export async function runRecurringForUser(
  userId: string,
  todayIso: string,
): Promise<{ processed: number; created: number }> {
  let processed = 0
  let created = 0

  // Tope defensivo: nunca más de 50 ticks por usuario por corrida — evita
  // loops si una rule mal configurada se queda corriendo.
  for (let safety = 0; safety < 50; safety++) {
    const due = await db
      .select({ id: recurringRules.id })
      .from(recurringRules)
      .where(
        and(
          eq(recurringRules.userId, userId),
          eq(recurringRules.active, true),
          lte(recurringRules.nextRun, todayIso),
        ),
      )
      .limit(20)

    if (due.length === 0) break

    for (const r of due) {
      const result = await tickRule(r.id, todayIso)
      processed++
      if (result.created) created++
    }
  }

  return { processed, created }
}

/**
 * Lista los user_ids con al menos una rule activa con next_run vencido.
 * Usado por el cron para filtrar a quien iterar.
 */
export async function listUsersWithDueRules(todayIso: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ userId: recurringRules.userId })
    .from(recurringRules)
    .where(
      and(
        eq(recurringRules.active, true),
        lte(recurringRules.nextRun, todayIso),
      ),
    )
  return rows.map((r) => r.userId)
}
