'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { db } from '@/lib/db/client'
import { weeklyCheckins } from '@/lib/db/schema'
import { generateWeeklyCheckin } from '@/lib/ai/checkin'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

/**
 * Genera el check-in de la semana actual on-demand (el cron lo corre los
 * domingos; esto permite verlo/regenerarlo cuando quieras).
 */
export async function runWeeklyCheckinNow(): Promise<ActionResult<{ weekStart: string }>> {
  const user = await requireCurrentUser()
  try {
    const { weekStart } = await generateWeeklyCheckin(user.id)
    revalidatePath('/dashboard')
    revalidateUserData(user.id)
    return { ok: true, data: { weekStart } }
  } catch {
    return { ok: false, error: { code: 'generate_failed', message: 'No se pudo generar el check-in.' } }
  }
}

/** Marca un check-in como leído. */
export async function markCheckinRead(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'invalid_id', message: 'ID inválido.' } }
  }
  await db
    .update(weeklyCheckins)
    .set({ status: 'read' })
    .where(and(eq(weeklyCheckins.id, id), eq(weeklyCheckins.userId, user.id)))
  revalidatePath('/dashboard')
  revalidateUserData(user.id)
  return { ok: true, data: undefined }
}
