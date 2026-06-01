import 'server-only'
import { revalidatePath, updateTag } from 'next/cache'

/** Tag del cache de datos del dashboard, por usuario (multi-tenant ready). */
export function dashboardTag(userId: string): string {
  return `dashboard:${userId}`
}

/**
 * Refresca el dashboard desde una Server Action: la ruta (Router Cache) y el
 * tag de los datos cacheados (unstable_cache en getDashboardData). Un solo
 * punto para que ambas invalidaciones no se desincronicen.
 */
export function revalidateDashboard(userId: string): void {
  revalidatePath('/dashboard')
  updateTag(dashboardTag(userId))
}
