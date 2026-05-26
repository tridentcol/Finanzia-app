import type { Metadata } from 'next'

import { EmptyState } from '@/components/app/empty-state'

export const metadata: Metadata = {
  title: 'Cuentas',
}

export default function CuentasPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm">Cuentas</p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.02em]">
          Todas tus cuentas
        </h1>
      </header>
      <EmptyState
        headline="Todavía no hay cuentas registradas."
        body="Las cuentas son la base de Finanzia: corrientes, tarjetas, ahorros, inversiones. Cada movimiento se asienta sobre una. Pronto podrás agregar la primera desde aquí."
      />
    </div>
  )
}
