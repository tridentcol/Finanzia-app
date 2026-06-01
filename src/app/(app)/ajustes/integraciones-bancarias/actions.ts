'use server'

import { and, eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { db } from '@/lib/db/client'
import { emailInboxAliases } from '@/lib/db/schema'
import { SUPPORTED_BANKS } from './bank-config'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

function generateSlug(length = 8): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const arr = new Uint8Array(length)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => chars[b % chars.length])
    .join('')
}

const createAliasSchema = z.object({
  bank: z.enum(SUPPORTED_BANKS),
  accountId: z.string().uuid().optional().nullable(),
})

export async function createEmailAlias(
  input: z.input<typeof createAliasSchema>,
): Promise<ActionResult<{ aliasSlug: string }>> {
  const user = await requireCurrentUser()

  const parsed = createAliasSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'Datos inválidos.' } }
  }

  // Max 1 alias per bank per user
  const existing = await db
    .select({ id: emailInboxAliases.id })
    .from(emailInboxAliases)
    .where(
      and(
        eq(emailInboxAliases.userId, user.id),
        eq(emailInboxAliases.bank, parsed.data.bank),
        eq(emailInboxAliases.active, true),
      ),
    )
    .limit(1)

  if (existing.length > 0) {
    return {
      ok: false,
      error: { code: 'already_exists', message: 'Ya tienes un alias activo para este banco.' },
    }
  }

  let aliasSlug = generateSlug()
  // Ensure uniqueness (retry once on collision)
  const collision = await db
    .select({ id: emailInboxAliases.id })
    .from(emailInboxAliases)
    .where(eq(emailInboxAliases.aliasSlug, aliasSlug))
    .limit(1)
  if (collision.length > 0) aliasSlug = generateSlug()

  await db.insert(emailInboxAliases).values({
    userId: user.id,
    aliasSlug,
    bank: parsed.data.bank,
    accountId: parsed.data.accountId ?? null,
  })

  revalidatePath('/ajustes/integraciones-bancarias')
  revalidateUserData(user.id)
  return { ok: true, data: { aliasSlug } }
}

export async function deleteEmailAlias(aliasId: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(aliasId).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  await db
    .update(emailInboxAliases)
    .set({ active: false })
    .where(and(eq(emailInboxAliases.id, aliasId), eq(emailInboxAliases.userId, user.id)))

  revalidatePath('/ajustes/integraciones-bancarias')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}

export async function updateAliasAccount(
  aliasId: string,
  accountId: string | null,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(aliasId).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }

  await db
    .update(emailInboxAliases)
    .set({ accountId })
    .where(and(eq(emailInboxAliases.id, aliasId), eq(emailInboxAliases.userId, user.id)))

  revalidatePath('/ajustes/integraciones-bancarias')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}
