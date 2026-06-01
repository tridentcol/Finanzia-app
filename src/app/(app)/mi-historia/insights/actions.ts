'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { db } from '@/lib/db/client'
import { insights } from '@/lib/db/schema'
import { runDetectorsForUser } from '@/lib/ai/insights'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

const idSchema = z.string().uuid('ID inválido')

export async function dismissInsight(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'ID inválido.' } }
  }
  await db
    .update(insights)
    .set({ status: 'dismissed' })
    .where(and(eq(insights.id, id), eq(insights.userId, user.id)))
  revalidatePath('/mi-historia/insights')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}

export async function markInsightActed(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'ID inválido.' } }
  }
  await db
    .update(insights)
    .set({ status: 'acted', actedAt: new Date() })
    .where(and(eq(insights.id, id), eq(insights.userId, user.id)))
  revalidatePath('/mi-historia/insights')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}

export async function markInsightRead(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = idSchema.safeParse(id)
  if (!parsed.success) {
    return { ok: false, error: { code: 'validation', message: 'ID inválido.' } }
  }
  await db
    .update(insights)
    .set({ status: 'read' })
    .where(
      and(
        eq(insights.id, id),
        eq(insights.userId, user.id),
        eq(insights.status, 'unread'),
      ),
    )
  revalidatePath('/mi-historia/insights')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}

/**
 * Disparo manual del pipeline de detectores para el usuario actual.
 * Útil para validar las lecturas sin esperar al cron.
 */
export async function runInsightsNow(): Promise<
  ActionResult<{ generated: number; skipped: number }>
> {
  const user = await requireCurrentUser()
  const result = await runDetectorsForUser(user.id)
  revalidatePath('/mi-historia/insights')
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: { generated: result.generated, skipped: result.skipped } }
}
