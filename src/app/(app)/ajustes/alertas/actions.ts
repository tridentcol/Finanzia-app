'use server'

import { revalidatePath } from 'next/cache'
import { and, eq, sql } from 'drizzle-orm'
import { z } from 'zod'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { alerts } from '@/lib/db/schema'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

export async function markAlertRead(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'validation', message: 'ID inválido.' } }
  }
  await db
    .update(alerts)
    .set({ read: true })
    .where(and(eq(alerts.id, id), eq(alerts.userId, user.id)))
  revalidatePath('/ajustes/alertas')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}

export async function markAllAlertsRead(): Promise<ActionResult> {
  const user = await requireCurrentUser()
  await db
    .update(alerts)
    .set({ read: true })
    .where(and(eq(alerts.userId, user.id), eq(alerts.read, false)))
  revalidatePath('/ajustes/alertas')
  revalidatePath('/dashboard')
  return { ok: true, data: undefined }
}

export async function deleteAlert(id: string): Promise<ActionResult> {
  const user = await requireCurrentUser()
  if (!z.string().uuid().safeParse(id).success) {
    return { ok: false, error: { code: 'validation', message: 'ID inválido.' } }
  }
  await db.delete(alerts).where(and(eq(alerts.id, id), eq(alerts.userId, user.id)))
  revalidatePath('/ajustes/alertas')
  return { ok: true, data: undefined }
}
