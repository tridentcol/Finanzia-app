import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'

export const metadata: Metadata = {
  title: 'Resumen',
}

export default async function DashboardPage() {
  const user = await requireCurrentUser()

  return (
    <div className="flex flex-col gap-16">
      <header className="flex flex-col gap-1.5">
        <p className="text-text-secondary text-sm">Resumen</p>
        <h1 className="display text-text text-6xl">
          <span className="amount">$0</span>
        </h1>
        <p className="text-text-tertiary text-xs">
          Saldo total · {user.email}
        </p>
      </header>

      <section className="border-border-default bg-surface flex flex-col gap-4 rounded-[12px] border p-10">
        <p className="editorial text-text-secondary text-lg leading-relaxed">
          Aún no hay movimientos registrados.
        </p>
        <p className="text-text-tertiary max-w-md text-sm leading-relaxed">
          Cuando agregues tu primera cuenta y empieces a registrar
          transacciones, Finanzia construirá tu bitácora aquí. Multi-divisa,
          asistida, ordenada.
        </p>
      </section>
    </div>
  )
}
