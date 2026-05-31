'use client'

import { useEffect } from 'react'
import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * Error boundary del segmento autenticado (regla 8). Captura fallos de render
 * en cualquier page de `(app)/*`, incluidas las rutas dinámicas `[id]`/`[period]`
 * (el boundary más cercano las cubre). Estética Noir: copy editorial Fraunces,
 * reset estilo text-sobre-bg.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // La captura a Sentry se hace en instrumentation/onRequestError; acá solo
    // dejamos rastro en consola para el cliente.
    console.error('[app/error]', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-start justify-center gap-6">
      <div className="flex flex-col gap-3">
        <p className="editorial text-text text-3xl leading-tight sm:text-4xl">
          Algo se salió de cauce.
        </p>
        <p className="text-text-secondary max-w-md text-sm leading-relaxed">
          No pudimos cargar esta vista. El error quedó registrado; podés
          reintentar o volver al inicio.
        </p>
        {error.digest && (
          <p className="text-text-tertiary font-mono text-[11px]">Ref: {error.digest}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button variant="ghost" asChild>
          <Link href="/dashboard">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  )
}
