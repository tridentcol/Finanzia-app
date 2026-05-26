import type { Metadata } from 'next'

import { EmptyState } from '@/components/app/empty-state'

export const metadata: Metadata = {
  title: 'Insights',
}

export default function InsightsPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm">Insights</p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.02em]">
          Lecturas de la IA
        </h1>
      </header>
      <EmptyState
        headline="Todavía no hay lecturas que ofrecer."
        body="Con suficientes movimientos registrados, Finanzia destila patrones, anomalías y recomendaciones. Una sección por semana, sin ruido."
      />
    </div>
  )
}
