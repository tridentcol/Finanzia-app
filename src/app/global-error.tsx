'use client'

import { useEffect } from 'react'

/**
 * Error boundary raíz — captura fallos del root layout (cuando ni el layout
 * pudo renderizar). Reemplaza al `<html>`, así que NO hereda globals.css:
 * los estilos van inline con los hex de la paleta Noir dark. Sin emojis,
 * sin gradientes, monocromático.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[global-error]', error)
  }, [error])

  return (
    <html lang="es">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 24,
          padding: '0 24px',
          background: '#0A0A0B',
          color: '#FAFAFA',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, fontSize: 28, lineHeight: 1.2 }}>
            Algo se rompió en la raíz.
          </p>
          <p
            style={{
              margin: 0,
              maxWidth: '28rem',
              fontSize: 14,
              lineHeight: 1.6,
              color: '#A1A1A8',
            }}
          >
            La aplicación no pudo iniciar esta vista. Reintentá; si el problema
            persiste, recargá la página.
          </p>
        </div>
        <button
          onClick={reset}
          style={{
            background: '#FAFAFA',
            color: '#0A0A0B',
            border: 'none',
            borderRadius: 8,
            padding: '8px 16px',
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </body>
    </html>
  )
}
