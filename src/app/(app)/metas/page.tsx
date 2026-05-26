import type { Metadata } from 'next'

import { EmptyState } from '@/components/app/empty-state'

export const metadata: Metadata = {
  title: 'Metas',
}

export default function MetasPage() {
  return (
    <div className="flex flex-col gap-10">
      <header className="flex flex-col gap-1">
        <p className="text-text-secondary text-sm">Metas</p>
        <h1 className="text-text text-3xl font-semibold tracking-[-0.02em]">
          Hacia dónde
        </h1>
      </header>
      <EmptyState
        headline="Aún no hay metas planteadas."
        body="Un fondo de emergencia, un viaje, una compra que necesita preparación. Lo definimos por monto y fecha; Finanzia mide la trayectoria."
      />
    </div>
  )
}
