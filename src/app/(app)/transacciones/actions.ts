'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull, or } from 'drizzle-orm'
import { randomUUID } from 'node:crypto'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { accounts, categories, profiles, transactions } from '@/lib/db/schema'
import { currencyCodes } from '@/lib/currency/currencies'
import { convertAmount } from '@/lib/currency/rates'

const txKindValues = ['income', 'expense', 'transfer'] as const

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha en formato YYYY-MM-DD')

const createTransactionSchema = z
  .object({
    kind: z.enum(txKindValues),
    accountId: z.string().uuid('ID inválido'),
    transferAccountId: z.string().uuid('ID inválido').optional().nullable(),
    categoryId: z.string().uuid('ID inválido').optional().nullable(),
    date: isoDate,
    amountOriginal: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (positivo, ej 1234.56)'),
    currency: z.enum(currencyCodes as [string, ...string[]]),
    description: z.string().trim().min(1, 'Requerido').max(200),
    merchant: z.string().trim().max(120).optional().nullable(),
    notes: z.string().trim().max(500).optional().nullable(),
  })
  .superRefine((val, ctx) => {
    if (val.kind === 'transfer') {
      if (!val.transferAccountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['transferAccountId'],
          message: 'La cuenta destino es requerida en transferencias.',
        })
      } else if (val.transferAccountId === val.accountId) {
        ctx.addIssue({
          code: 'custom',
          path: ['transferAccountId'],
          message: 'La cuenta destino debe ser distinta de la origen.',
        })
      }
    }
  })

export type CreateTransactionInput = z.input<typeof createTransactionSchema>

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()

  const parsed = createTransactionSchema.safeParse(input)
  if (!parsed.success) {
    const fields: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path.join('.')
      if (key) fields[key] = issue.message
    }
    return {
      ok: false,
      error: { code: 'validation', message: 'Revisa los campos.', fields },
    }
  }

  const data = parsed.data

  const sourceAccount = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)),
  })
  if (!sourceAccount) {
    return {
      ok: false,
      error: { code: 'invalid_account', message: 'Cuenta inválida.' },
    }
  }
  if (sourceAccount.currency !== data.currency) {
    return {
      ok: false,
      error: {
        code: 'currency_mismatch',
        message: 'La moneda de la transacción debe coincidir con la cuenta.',
        fields: { currency: `La cuenta es ${sourceAccount.currency}.` },
      },
    }
  }

  let targetAccount: typeof sourceAccount | null = null
  if (data.kind === 'transfer' && data.transferAccountId) {
    const found = await db.query.accounts.findFirst({
      where: and(
        eq(accounts.id, data.transferAccountId),
        eq(accounts.userId, user.id),
      ),
    })
    if (!found) {
      return {
        ok: false,
        error: { code: 'invalid_transfer_account', message: 'Cuenta destino inválida.' },
      }
    }
    targetAccount = found
  }

  if (data.categoryId) {
    const category = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.categoryId),
        or(isNull(categories.userId), eq(categories.userId, user.id)),
      ),
    })
    if (!category) {
      return {
        ok: false,
        error: { code: 'invalid_category', message: 'Categoría inválida.' },
      }
    }
    if (category.kind !== data.kind) {
      return {
        ok: false,
        error: {
          code: 'category_kind_mismatch',
          message: `La categoría es de tipo ${category.kind}, no ${data.kind}.`,
        },
      }
    }
  }

  const profile = await db.query.profiles.findFirst({
    where: eq(profiles.userId, user.id),
  })
  const baseCurrency = profile?.baseCurrency ?? 'COP'

  // Cross-currency transfer → dos asientos espejo (uno en cada cuenta y moneda).
  if (
    data.kind === 'transfer' &&
    targetAccount &&
    targetAccount.currency !== sourceAccount.currency
  ) {
    const transferGroupId = randomUUID()

    const [srcBase, dstAmount] = await Promise.all([
      // amount_base del leg origen (en su moneda → base).
      convertAmount(data.amountOriginal, sourceAccount.currency, baseCurrency, data.date, {
        fallbackToOne: true,
      }),
      // Monto que llega a la cuenta destino, en su moneda nativa.
      convertAmount(
        data.amountOriginal,
        sourceAccount.currency,
        targetAccount.currency,
        data.date,
        { fallbackToOne: true },
      ),
    ])
    // amount_base del leg destino: el monto en moneda destino convertido a base.
    const dstBase = await convertAmount(
      dstAmount.amount,
      targetAccount.currency,
      baseCurrency,
      data.date,
      { fallbackToOne: true },
    )

    const insertRows = [
      // Origen: amount_original en moneda origen, transfer_account_id apunta a destino.
      {
        userId: user.id,
        accountId: sourceAccount.id,
        categoryId: null,
        date: data.date,
        amountOriginal: data.amountOriginal,
        currency: sourceAccount.currency,
        amountBase: srcBase.amount,
        exchangeRate: srcBase.rate,
        description: data.description,
        merchant: data.merchant ?? null,
        kind: 'transfer' as const,
        transferAccountId: targetAccount.id,
        transferGroupId,
        notes: data.notes ?? null,
      },
      // Destino: amount_original en moneda destino, transfer_account_id null (sumar).
      {
        userId: user.id,
        accountId: targetAccount.id,
        categoryId: null,
        date: data.date,
        amountOriginal: dstAmount.amount,
        currency: targetAccount.currency,
        amountBase: dstBase.amount,
        exchangeRate: dstBase.rate,
        description: data.description,
        merchant: data.merchant ?? null,
        kind: 'transfer' as const,
        transferAccountId: null,
        transferGroupId,
        notes: data.notes ?? null,
      },
    ]

    const inserted = await db.insert(transactions).values(insertRows).returning({
      id: transactions.id,
    })
    if (inserted.length !== 2) {
      return {
        ok: false,
        error: { code: 'insert_failed', message: 'No se pudo crear la transferencia.' },
      }
    }

    revalidatePath('/transacciones')
    revalidatePath('/cuentas')
    revalidatePath('/dashboard')
    return { ok: true, data: { id: inserted[0]!.id } }
  }

  // Caso simple (income/expense/same-currency transfer).
  const { amount: amountBase, rate: exchangeRate } = await convertAmount(
    data.amountOriginal,
    sourceAccount.currency,
    baseCurrency,
    data.date,
    { fallbackToOne: true },
  )

  const [row] = await db
    .insert(transactions)
    .values({
      userId: user.id,
      accountId: data.accountId,
      categoryId: data.categoryId ?? null,
      date: data.date,
      amountOriginal: data.amountOriginal,
      currency: data.currency,
      amountBase,
      exchangeRate,
      description: data.description,
      merchant: data.merchant ?? null,
      kind: data.kind,
      transferAccountId:
        data.kind === 'transfer' ? data.transferAccountId ?? null : null,
      notes: data.notes ?? null,
    })
    .returning({ id: transactions.id })

  if (!row) {
    return {
      ok: false,
      error: { code: 'insert_failed', message: 'No se pudo crear la transacción.' },
    }
  }

  revalidatePath('/transacciones')
  revalidatePath('/cuentas')
  revalidatePath('/dashboard')
  return { ok: true, data: { id: row.id } }
}

