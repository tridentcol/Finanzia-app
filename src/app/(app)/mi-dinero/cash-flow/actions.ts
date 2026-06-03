'use server'

import { revalidatePath } from 'next/cache'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { getProfile } from '@/lib/db/queries/profile'
import { backfillNetWorth, captureNetWorthSnapshot } from '@/lib/db/queries/net-worth'
import type { CurrencyCode } from '@/lib/currency/currencies'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

/**
 * Reconstruye el histórico de patrimonio neto desde el ledger y captura el
 * punto de hoy con composición. On-demand (el cron mensual lo mantiene al día).
 */
export async function runNetWorthBackfillNow(): Promise<ActionResult<{ inserted: number }>> {
  const user = await requireCurrentUser()
  try {
    const profile = await getProfile(user.id)
    const baseCurrency = (profile?.baseCurrency ?? 'COP') as CurrencyCode
    const today = new Date().toISOString().slice(0, 10)

    const { inserted } = await backfillNetWorth(user.id, baseCurrency, today)
    await captureNetWorthSnapshot(user.id, baseCurrency, today)

    revalidatePath('/mi-dinero/cash-flow')
    revalidateUserData(user.id)
    return { ok: true, data: { inserted } }
  } catch {
    return {
      ok: false,
      error: { code: 'backfill_failed', message: 'No se pudo reconstruir el historial.' },
    }
  }
}
