import type { Metadata } from 'next'
import Link from 'next/link'
import { and, eq } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { db } from '@/lib/db/client'
import { emailInboxAliases, accounts } from '@/lib/db/schema'
import { IntegracionesBancariasClient } from './integraciones-client'

export const metadata: Metadata = {
  title: 'Alertas bancarias por email',
}

export default async function IntegracionesBancariasPage() {
  const user = await requireCurrentUser()

  const [aliases, accountsList] = await Promise.all([
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
          eq(emailInboxAliases.userId, user.id),
          eq(emailInboxAliases.active, true),
        ),
      )
      .orderBy(emailInboxAliases.createdAt),
    db
      .select({ id: accounts.id, name: accounts.name, currency: accounts.currency })
      .from(accounts)
      .where(and(eq(accounts.userId, user.id), eq(accounts.archived, false)))
      .orderBy(accounts.name),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex min-w-0 flex-col gap-1.5">
        <Link
          href="/ajustes"
          className="text-text-tertiary hover:text-text-secondary text-[13px] transition-colors w-fit"
        >
          ← Ajustes
        </Link>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Alertas bancarias por email
        </h1>
        <p className="text-text-secondary editorial max-w-prose text-base italic">
          Sin scraping, sin credenciales bancarias. Solo reenvío de emails.
        </p>
      </header>

      <IntegracionesBancariasClient
        aliases={aliases.map((a) => ({ ...a, createdAt: new Date(a.createdAt) }))}
        accounts={accountsList}
        userId={user.id}
      />
    </div>
  )
}
