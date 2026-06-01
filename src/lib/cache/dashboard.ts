import 'server-only'
import { revalidatePath } from 'next/cache'

import { revalidateUserData } from '@/lib/cache/data'

/**
 * Refresca el dashboard desde una Server Action: el Router Cache de la ruta
 * (para que el saldo se vea fresco al instante aunque el usuario no esté en
 * /dashboard) y toda la data cacheada vía el tag coarse `data:${userId}`. Un
 * solo punto para que ambas invalidaciones no se desincronicen.
 */
export function revalidateDashboard(userId: string): void {
  revalidatePath('/dashboard')
  revalidateUserData(userId)
}
