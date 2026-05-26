import type { Metadata } from 'next'

import { EmptyState } from '@/components/app/empty-state'

export const metadata: Metadata = {
  title: 'Transacciones',
}

export default function TransaccionesPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm">Transacciones</p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.02em]">
          Bitácora
        </h1>
      </header>
      <EmptyState
        headline="Sin movimientos para mostrar."
        body="Cuando importes un extracto o registres un gasto manualmente, lo verás aquí. Multi-divisa, ordenado, categorizado por la IA."
      />
    </div>
  )
}
