import Link from 'next/link'

import { Button } from '@/components/ui/button'

/**
 * 404 raíz — URLs que no matchean ninguna ruta (fuera de `(app)`). Se renderiza
 * dentro del root layout (sin rail). Estética Noir, copy editorial.
 */
export default function NotFound() {
  return (
    <main className="bg-background text-text flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <p className="editorial text-text text-3xl leading-tight sm:text-4xl">
          Esto no existe.
        </p>
        <p className="text-text-secondary max-w-md text-sm leading-relaxed">
          La dirección que abriste no corresponde a ninguna página.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard">Ir al inicio</Link>
      </Button>
    </main>
  )
}
