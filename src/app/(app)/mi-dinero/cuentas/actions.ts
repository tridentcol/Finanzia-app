'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateDashboard } from '@/lib/cache/dashboard'
import { db } from '@/lib/db/client'
import { accounts } from '@/lib/db/schema'
import { currencyCodes } from '@/lib/currency/currencies'

// Tipos de cuenta — cuentas líquidas y activos. Las tarjetas de crédito viven
// en /mi-dinero/tarjetas con sus propias actions (createCard, etc.).
const accountTypeValues = [
  'checking',
  'savings',
  'cash',
  'investment',
  'crypto',
  'other',
] as const

const createAccountSchema = z.object({
  name: z.string().trim().min(1, 'Requerido').max(80, 'Máx 80 caracteres'),
  type: z.enum(accountTypeValues),
  currency: z.enum(currencyCodes as [string, ...string[]]),
  initialBalance: z
    .string()
    .regex(/^-?\d+(\.\d{1,2})?$/, 'Formato inválido (ej. 1000.00)'),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, 'Hex inválido')
    .optional()
    .nullable(),
  icon: z.string().min(1).max(40).optional().nullable(),
})

export type CreateAccountInput = z.input<typeof createAccountSchema>

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string; fields?: Record<string, string> } }

function revalidateAccountPaths(userId: string) {
  revalidatePath('/mi-dinero/cuentas')
  revalidateDashboard(userId)
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireCurrentUser()

  const parsed = createAccountSchema.safeParse(input)
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
  const [row] = await db
    .insert(accounts)
    .values({
      userId: user.id,
      name: data.name,
      type: data.type,
      currency: data.currency,
      initialBalance: data.initialBalance,
      color: data.color ?? null,
      icon: data.icon ?? null,
    })
    .returning({ id: accounts.id })

  if (!row) {
    return {
      ok: false,
      error: { code: 'insert_failed', message: 'No se pudo crear la cuenta.' },
    }
  }

  revalidateAccountPaths(user.id)
  return { ok: true, data: { id: row.id } }
}

export async function archiveAccount(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  // Verifica que la cuenta exista y no sea una tarjeta — las tarjetas se
  // archivan desde /mi-dinero/tarjetas con archiveCard.
  const [acct] = await db
    .select({ type: accounts.type })
    .from(accounts)
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
    .limit(1)

  if (!acct) {
    return { ok: false, error: { code: 'not_found', message: 'Cuenta no encontrada.' } }
  }
  if (acct.type === 'credit_card') {
    return {
      ok: false,
      error: { code: 'wrong_resource', message: 'Las tarjetas se archivan desde Tarjetas.' },
    }
  }

  await db
    .update(accounts)
    .set({ archived: true, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))

  revalidateAccountPaths(user.id)
  return { ok: true, data: undefined }
}
