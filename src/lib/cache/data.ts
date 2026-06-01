import 'server-only'
import { updateTag } from 'next/cache'

/**
 * Tag coarse de TODA la data cacheada de un usuario (multi-tenant ready).
 * Cada query envuelta en `unstable_cache` lo declara como su único tag de datos.
 */
export function userDataTag(userId: string): string {
  return `data:${userId}`
}

/**
 * Refresca toda la data cacheada del usuario desde una Server Action.
 *
 * Single-user: mutación infrecuente, navegación frecuente → un solo tag coarse
 * evita stale-bugs por olvidar invalidar una ruta puntual. Cualquier mutación
 * bustea todo; la próxima navegación re-renderiza fresco. Las Server Actions
 * siguen llamando sus `revalidatePath` para refrescar el Router Cache de la
 * ruta que el usuario está mirando en ese momento.
 */
export function revalidateUserData(userId: string): void {
  updateTag(userDataTag(userId))
}
