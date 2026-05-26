import type { Metadata } from 'next'

import { EmptyState } from '@/components/app/empty-state'

export const metadata: Metadata = {
  title: 'Presupuestos',
}

export default function PresupuestosPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm">Presupuestos</p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.02em]">
          Mensuales
        </h1>
      </header>
      <EmptyState
        headline="No has definido presupuestos."
        body="Asigna un tope mensual a cualquier categoría. Finanzia te avisará cuando estés cerca del límite, sin sermones."
      />
    </div>
  )
}
