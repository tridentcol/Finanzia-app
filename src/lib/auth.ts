import 'server-only'
import { cache } from 'react'
import { auth, currentUser } from '@clerk/nextjs/server'
import { eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { profiles, users, type User } from '@/lib/db/schema'

/**
 * Devuelve la fila de `users` correspondiente al Clerk user activo.
 *
 * Estrategia:
 *  1. Resuelve `auth()` para obtener el `clerkUserId` del JWT del request.
 *  2. Busca la fila en `users` por `clerkId`.
 *  3. Si no existe (race con el webhook al firstsignup), hace upsert lazy
 *     con los datos de `currentUser()` y crea el `profile` default.
 *
 * Memoizado por request con `React.cache`.
 */
export const getCurrentUser = cache(async (): Promise<User | null> => {
  const { userId: clerkUserId } = await auth()
  if (!clerkUserId) return null

  const existing = await db.query.users.findFirst({
    where: eq(users.clerkId, clerkUserId),
  })
  if (existing) return existing

  // Fallback: el webhook aún no llegó. Hacemos upsert lazy.
  const clerkUser = await currentUser()
  if (!clerkUser) return null

  const email =
    clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
      ?.emailAddress ?? clerkUser.emailAddresses[0]?.emailAddress
  if (!email) return null

  const composed = [clerkUser.firstName?.trim(), clerkUser.lastName?.trim()]
    .filter(Boolean)
    .join(' ')
  const name = composed.length > 0 ? composed : null

  const [inserted] = await db
    .insert(users)
    .values({ clerkId: clerkUserId, email, name })
    .onConflictDoUpdate({
      target: users.clerkId,
      set: { email, name, updatedAt: new Date() },
    })
    .returning()

  if (inserted) {
    await db.insert(profiles).values({ userId: inserted.id }).onConflictDoNothing()
  }

  return inserted ?? null
})

/**
 * Igual que `getCurrentUser` pero lanza si no hay sesión.
 * Usar en rutas/Server Actions donde el middleware ya garantizó auth.
 */
export async function requireCurrentUser(): Promise<User> {
  const user = await getCurrentUser()
  if (!user) throw new Error('Usuario no autenticado.')
  return user
}
