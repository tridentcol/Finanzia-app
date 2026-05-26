import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Resumen',
}

export default async function DashboardPage() {
  const user = await requireCurrentUser()

  return (
    <div className="flex flex-col gap-12">
      <header className="flex flex-col gap-2">
        <p className="text-foreground/50 text-sm">Bienvenido</p>
        <h1 className="text-foreground text-3xl font-semibold tracking-[-0.02em]">
          {user.name ?? user.email}
        </h1>
      </header>

      <section className="border-border bg-card text-foreground rounded-xl border p-8">
        <p className="text-foreground/60 text-sm">
          La sesión está activa. El esquema de datos está aplicado y las
          categorías sistema sembradas. El siguiente paso construye el sistema
          de diseño definitivo y el shell con rail lateral.
        </p>
      </section>
    </div>
  )
}
