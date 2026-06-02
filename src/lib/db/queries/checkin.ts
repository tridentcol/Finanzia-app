import 'server-only'
import { desc, eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { weeklyCheckins, type WeeklyCheckin } from '@/lib/db/schema'
import { userDataTag } from '@/lib/cache/data'

/**
 * Último check-in semanal del usuario (cualquier estado), cacheado cross-request.
 * El tag coarse `data:${userId}` lo bustea generar/marcar-leído un check-in.
 */
export function getLatestCheckin(userId: string): Promise<WeeklyCheckin | null> {
  return unstable_cache(
    async () => {
      const row = await db.query.weeklyCheckins.findFirst({
        where: eq(weeklyCheckins.userId, userId),
        orderBy: [desc(weeklyCheckins.weekStart)],
      })
      return row ?? null
    },
    ['latest-checkin', userId],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()
}
