'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { accounts, importBatches, profiles, transactions } from '@/lib/db/schema'
import { parseRow, type ParseRowError } from '@/lib/import/parse-row'
import type { ColumnMapping } from '@/lib/import/infer-columns'
import { convertAmount, getRate } from '@/lib/currency/rates'

const importSchema = z.object({
  accountId: z.string().uuid(),
  filename: z.string().min(1).max(200),
  mapping: z.record(z.string(), z.string()),
  rows: z.array(z.record(z.string(), z.unknown())).max(5000, 'Máximo 5000 filas por import'),
})

export type ImportInput = z.input<typeof importSchema>

export type ImportResult =
  | {
      ok: true
      data: {
        batchId: string
        imported: number
        skipped: number
        errors: ParseRowError[]
      }
    }
  | { ok: false; error: { code: string; message: string } }

export async function runImport(input: ImportInput): Promise<ImportResult> {
  const user = await requireCurrentUser()
  const parsed = importSchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'validation', message: parsed.error.issues[0]?.message ?? 'Datos inválidos.' },
    }
  }
  const data = parsed.data
  const mapping = data.mapping as ColumnMapping

  // Verificar cuenta del usuario
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)),
  })
  if (!account) {
    return {
      ok: false,
      error: { code: 'invalid_account', message: 'Cuenta inválida.' },
    }
  }

  // Crear batch en pending
  const [batch] = await db
    .insert(importBatches)
    .values({
      userId: user.id,
      accountId: account.id,
      filename: data.filename,
      totalRows: data.rows.length,
      status: 'processing',
      mapping: mapping as Record<string, string>,
    })
    .returning({ id: importBatches.id })
  if (!batch) {
    return {
      ok: false,
      error: { code: 'batch_failed', message: 'No se pudo crear el batch.' },
    }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })
  const baseCurrency = profile?.baseCurrency ?? 'COP'
  const accountCurrency = account.currency
  const sameCurrency = accountCurrency === baseCurrency

  // Cache de tasas por fecha para evitar N queries idénticas.
  const rateCache = new Map<string, string>()
  async function rateFor(date: string): Promise<string> {
    if (sameCurrency) return '1.000000'
    const cached = rateCache.get(date)
    if (cached) return cached
    const rate = await getRate(accountCurrency, baseCurrency, date)
    const resolved = rate ?? '1.000000'
    rateCache.set(date, resolved)
    return resolved
  }

  const errors: ParseRowError[] = []
  const toInsert: typeof transactions.$inferInsert[] = []

  for (let i = 0; i < data.rows.length; i++) {
    const result = parseRow(data.rows[i] as Record<string, unknown>, mapping, i)
    if ('reason' in result) {
      errors.push(result)
      continue
    }
    let amountBase = result.amount
    let exchangeRate: string = '1.000000'
    if (!sameCurrency) {
      const conv = await convertAmount(
        result.amount,
        account.currency,
        baseCurrency,
        result.date,
        { fallbackToOne: true },
      )
      amountBase = conv.amount
      exchangeRate = conv.rate
    } else {
      // Persistimos también la tasa cached por consistencia (1.000000).
      exchangeRate = await rateFor(result.date)
    }
    toInsert.push({
      userId: user.id,
      accountId: account.id,
      categoryId: null,
      date: result.date,
      amountOriginal: result.amount,
      currency: account.currency,
      amountBase,
      exchangeRate,
      description: result.description,
      merchant: result.merchant,
      kind: result.kind,
      importBatchId: batch.id,
    })
  }

  // Inserción por chunks para no exceder param limits
  const CHUNK = 200
  let imported = 0
  if (toInsert.length > 0) {
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const chunk = toInsert.slice(i, i + CHUNK)
      await db.insert(transactions).values(chunk)
      imported += chunk.length
    }
  }

  await db
    .update(importBatches)
    .set({
      status: errors.length === data.rows.length ? 'failed' : 'completed',
      importedRows: imported,
      errors: errors.length > 0 ? errors.slice(0, 50) : null,
      completedAt: new Date(),
    })
    .where(eq(importBatches.id, batch.id))

  revalidatePath('/importar')
  revalidatePath('/transacciones')
  revalidatePath('/cuentas')
  revalidatePath('/dashboard')

  return {
    ok: true,
    data: {
      batchId: batch.id,
      imported,
      skipped: errors.length,
      errors,
    },
  }
}
