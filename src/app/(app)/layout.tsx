import Link from 'next/link'
import { UserButton } from '@clerk/nextjs'

import { requireCurrentUser } from '@/lib/auth'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  // Forzamos resolución temprana para fallar limpio si auth se rompe.
  // El middleware ya garantiza que solo lleguen requests autenticados.
  await requireCurrentUser()

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="border-border/60 flex h-14 items-center justify-between border-b px-6">
        <Link
          href="/dashboard"
          className="text-foreground text-sm font-semibold tracking-tight"
        >
          Finanzia
        </Link>
        <UserButton
          appearance={{
            elements: {
              userButtonAvatarBox: { width: '28px', height: '28px' },
            },
          }}
        />
      </header>
      <main className="mx-auto w-full max-w-[1240px] flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  )
}
