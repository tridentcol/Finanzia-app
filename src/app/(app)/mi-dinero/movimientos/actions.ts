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
import {
  categorizeTransaction,
  recategorizeUnclassified,
} from '@/lib/ai/categorize'
import { embedTransaction } from '@/lib/ai/embed-transaction'

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

    revalidatePath('/mi-dinero/movimientos')
    revalidatePath('/mi-dinero/cuentas')
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

  // Si el usuario no eligió categoría y el kind no es transfer, le pedimos
  // a la IA que sugiera (kNN + LLM fallback). Si las keys no están
  // configuradas o no hay confianza, queda sin categoría.
  let aiSuggestion: Awaited<ReturnType<typeof categorizeTransaction>> = null
  if (!data.categoryId && data.kind !== 'transfer') {
    try {
      aiSuggestion = await categorizeTransaction({
        userId: user.id,
        description: data.description,
        merchant: data.merchant ?? null,
        kind: data.kind,
      })
    } catch {
      aiSuggestion = null
    }
  }

  const [row] = await db
    .insert(transactions)
    .values({
      userId: user.id,
      accountId: data.accountId,
      categoryId:
        data.categoryId ?? (aiSuggestion?.categoryId ? aiSuggestion.categoryId : null),
      aiCategorized: !data.categoryId && !!aiSuggestion?.categoryId,
      aiConfidence:
        !data.categoryId && aiSuggestion?.confidence && aiSuggestion.confidence > 0
          ? aiSuggestion.confidence.toFixed(2)
          : null,
      embedding: aiSuggestion?.embedding ?? undefined,
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

  revalidatePath('/mi-dinero/movimientos')
  revalidatePath('/mi-dinero/cuentas')
  revalidatePath('/dashboard')
  return { ok: true, data: { id: row.id } }
}

const setCategorySchema = z.object({
  transactionId: z.string().uuid('ID inválido'),
  categoryId: z.string().uuid('ID inválido').nullable(),
})

/**
 * Cambia la categoría de una transacción y marca `user_corrected = true`.
 * Si la transacción aún no tiene embedding (fue creada sin IA), lo genera
 * para que sea ciudadana de primera clase en futuras kNN. La señal
 * `user_corrected` enseña al modelo en sesiones posteriores.
 */
export async function setTransactionCategory(input: {
  transactionId: string
  categoryId: string | null
}): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = setCategorySchema.safeParse(input)
  if (!parsed.success) {
    return {
      ok: false,
      error: { code: 'validation', message: 'ID inválido.' },
    }
  }
  const { transactionId, categoryId } = parsed.data

  const tx = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, transactionId), eq(transactions.userId, user.id)),
  })
  if (!tx) {
    return {
      ok: false,
      error: { code: 'not_found', message: 'Transacción no encontrada.' },
    }
  }

  if (categoryId) {
    const cat = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, categoryId),
        or(isNull(categories.userId), eq(categories.userId, user.id)),
      ),
    })
    if (!cat) {
      return {
        ok: false,
        error: { code: 'invalid_category', message: 'Categoría inválida.' },
      }
    }
    if (cat.kind !== tx.kind) {
      return {
        ok: false,
        error: {
          code: 'kind_mismatch',
          message: `La categoría es de tipo ${cat.kind}, no ${tx.kind}.`,
        },
      }
    }
  }

  // Si la transacción aún no tiene embedding, intentamos generarlo ahora.
  let embedding: number[] | null = null
  if (!tx.embedding) {
    try {
      embedding = await embedTransaction(tx.description, tx.merchant)
    } catch {
      embedding = null
    }
  }

  await db
    .update(transactions)
    .set({
      categoryId,
      userCorrected: true,
      aiCategorized: false,
      aiConfidence: null,
      ...(embedding ? { embedding } : {}),
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, transactionId))

  revalidatePath('/mi-dinero/movimientos')
  revalidatePath('/dashboard')
  revalidatePath('/mi-plan/presupuestos')
  return { ok: true, data: undefined }
}

/**
 * Re-categoriza con IA todas las transacciones del usuario que estén sin
 * categoría y no marcadas como corregidas por el usuario. Procesa en chunks.
 */
export async function bulkRecategorize(): Promise<
  ActionResult<{ processed: number; categorized: number }>
> {
  const user = await requireCurrentUser()
  const result = await recategorizeUnclassified(user.id, { limit: 200 })
  revalidatePath('/mi-dinero/movimientos')
  revalidatePath('/dashboard')
  return { ok: true, data: result }
}

// ──────────────────────────────────────────────────────────────────────
// Update / Delete transaction
// ──────────────────────────────────────────────────────────────────────

const updateTransactionSchema = z.object({
  id: z.string().uuid('ID inválido'),
  accountId: z.string().uuid('ID inválido'),
  categoryId: z.string().uuid('ID inválido').optional().nullable(),
  date: isoDate,
  amountOriginal: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Monto inválido (positivo, ej 1234.56)'),
  description: z.string().trim().min(1, 'Requerido').max(200),
  notes: z.string().trim().max(500).optional().nullable(),
})

export type UpdateTransactionInput = z.input<typeof updateTransactionSchema>

/**
 * Edita una transacción existente. Para mantener invariantes (transfer
 * group, amount_base, etc.), no permitimos cambiar `kind` ni `currency`
 * ni el `transferAccountId`. Si necesitas eso, borra y crea de nuevo.
 *
 * Recalcula `amount_base` si cambió el monto o la fecha (porque la tasa
 * de cambio del día puede ser distinta).
 */
export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = updateTransactionSchema.safeParse(input)
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

  const tx = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, data.id), eq(transactions.userId, user.id)),
  })
  if (!tx) {
    return {
      ok: false,
      error: { code: 'not_found', message: 'Transacción no encontrada.' },
    }
  }

  // No permitimos editar transfers desde acá — la mecánica de espejo
  // cross-currency es compleja y mejor borrarla y recrearla.
  if (tx.kind === 'transfer') {
    return {
      ok: false,
      error: {
        code: 'transfer_immutable',
        message:
          'Las transferencias no se editan. Bórrala y registra una nueva.',
      },
    }
  }

  // Verificar cuenta destino válida.
  const account = await db.query.accounts.findFirst({
    where: and(eq(accounts.id, data.accountId), eq(accounts.userId, user.id)),
  })
  if (!account) {
    return {
      ok: false,
      error: { code: 'invalid_account', message: 'Cuenta inválida.' },
    }
  }

  // Validar categoría si viene.
  if (data.categoryId) {
    const cat = await db.query.categories.findFirst({
      where: and(
        eq(categories.id, data.categoryId),
        or(isNull(categories.userId), eq(categories.userId, user.id)),
      ),
    })
    if (!cat) {
      return {
        ok: false,
        error: { code: 'invalid_category', message: 'Categoría inválida.' },
      }
    }
    if (cat.kind !== tx.kind) {
      return {
        ok: false,
        error: {
          code: 'kind_mismatch',
          message: `La categoría es de tipo ${cat.kind}, no ${tx.kind}.`,
        },
      }
    }
  }

  // Si cambió monto o fecha, recalculamos amount_base con la tasa del día.
  const amountChanged = data.amountOriginal !== tx.amountOriginal
  const dateChanged = data.date !== tx.date
  let amountBase = tx.amountBase
  if (amountChanged || dateChanged) {
    const profile = await db.query.profiles.findFirst({
      where: eq(profiles.userId, user.id),
    })
    const baseCurrency = profile?.baseCurrency ?? 'COP'
    if (tx.currency === baseCurrency) {
      amountBase = data.amountOriginal
    } else {
      try {
        const converted = await convertAmount(
          data.amountOriginal,
          tx.currency,
          baseCurrency,
          data.date,
          { fallbackToOne: true },
        )
        amountBase = converted.amount
      } catch {
        amountBase = data.amountOriginal
      }
    }
  }

  await db
    .update(transactions)
    .set({
      accountId: data.accountId,
      categoryId: data.categoryId ?? null,
      date: data.date,
      amountOriginal: data.amountOriginal,
      amountBase,
      description: data.description,
      notes: data.notes ?? null,
      updatedAt: new Date(),
    })
    .where(eq(transactions.id, data.id))

  revalidatePath('/mi-dinero/movimientos')
  revalidatePath('/mi-dinero/cuentas')
  revalidatePath('/mi-dinero/tarjetas')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}

/**
 * Borra una transacción soft (sets deleted_at). Si es transfer, también
 * borra la fila espejo (mismo transfer_group_id) para mantener consistencia.
 */
export async function deleteTransaction(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  const tx = await db.query.transactions.findFirst({
    where: and(eq(transactions.id, id), eq(transactions.userId, user.id)),
  })
  if (!tx) {
    return {
      ok: false,
      error: { code: 'not_found', message: 'Transacción no encontrada.' },
    }
  }

  const now = new Date()

  // Soft-delete con deleted_at — preserva historial para auditoría.
  if (tx.transferGroupId) {
    // Borra ambas filas del par espejo.
    await db
      .update(transactions)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(transactions.userId, user.id),
          eq(transactions.transferGroupId, tx.transferGroupId),
        ),
      )
  } else {
    await db
      .update(transactions)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(transactions.id, id))
  }

  revalidatePath('/mi-dinero/movimientos')
  revalidatePath('/mi-dinero/cuentas')
  revalidatePath('/mi-dinero/tarjetas')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}
