import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * 404 del segmento autenticado (regla 8). Se renderiza cuando una page de
 * `(app)/*` llama `notFound()` — p. ej. `cuentas/[id]` con un id inexistente.
 * Estética Noir: copy editorial Fraunces, sin ilustración (regla 14).
 */
export default function AppNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-6">
      <div className="flex flex-col gap-3">
        <p className="editorial text-text text-3xl leading-tight sm:text-4xl">
          Esto no existe.
        </p>
        <p className="text-text-secondary max-w-md text-sm leading-relaxed">
          El enlace que seguiste no lleva a ningún lado, o lo que buscabas se
          movió de lugar.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Volver al inicio</Link>
      </Button>
    </div>
  )
}
