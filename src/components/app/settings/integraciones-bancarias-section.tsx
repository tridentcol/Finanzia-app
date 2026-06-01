import { and, eq } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'

import { db } from '@/lib/db/client'
import { emailInboxAliases, accounts } from '@/lib/db/schema'
import { userDataTag } from '@/lib/cache/data'
import { IntegracionesBancariasClient } from '@/app/(app)/ajustes/integraciones-bancarias/integraciones-client'

type Props = { userId: string }

export async function IntegracionesBancariasSection({ userId }: Props) {
  // Cacheado cross-request bajo el tag coarse `data:${userId}`; lo bustean las
  // Server Actions de alias bancarios y las de cuentas.
  const [aliases, accountsList] = await unstable_cache(
    () =>
      Promise.all([
        db
          .select({
            id: emailInboxAliases.id,
            aliasSlug: emailInboxAliases.aliasSlug,
            bank: emailInboxAliases.bank,
            accountId: emailInboxAliases.accountId,
            createdAt: emailInboxAliases.createdAt,
          })
          .from(emailInboxAliases)
          .where(
            and(
              eq(emailInboxAliases.userId, userId),
              eq(emailInboxAliases.active, true),
            ),
          )
          .orderBy(emailInboxAliases.createdAt),
        db
          .select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
          .from(accounts)
          .where(and(eq(accounts.userId, userId), eq(accounts.archived, false)))
          .orderBy(accounts.name),
      ]),
    ['integraciones-bancarias-section', userId],
    { tags: [userDataTag(userId)], revalidate: 30 },
  )()

  return (
    <IntegracionesBancariasClient
      aliases={aliases.map((a) => ({ ...a, createdAt: new Date(a.createdAt) }))}
      accounts={accountsList}
      userId={userId}
    />
  )
}
