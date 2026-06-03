'use client'

import { useEffect, useState } from 'react'

/**
 * TEMPORAL — overlay de diagnóstico para el shell en iOS PWA. Imprime en
 * pantalla los valores reales del viewport y safe-area para entender por qué
 * queda hueco abajo. Quitar (componente + uso en layout) una vez diagnosticado.
 *
 * Pista clave: comparar `screen.height` (pantalla física, en puntos) con
 * `innerHeight`/`100dvh`. Si 100dvh < screen.height, el viewport NO incluye el
 * área del home indicator → ahí está el hueco. La línea roja marca dónde cae un
 * `position:fixed; bottom:0` físicamente.
 */

function measureCss(value: string): string {
  const el = document.createElement('div')
  el.style.cssText = `position:fixed;left:-9999px;top:0;width:1px;height:${value};`
  document.body.appendChild(el)
  const h = getComputedStyle(el).height
  el.remove()
  return h
}

export function ShellDebug() {
  const [rows, setRows] = useState<Array<[string, string]>>([])

  useEffect(() => {
    function read() {
      const vv = window.visualViewport
      const nav = navigator as Navigator & { standalone?: boolean }
      setRows([
        [
          'standalone',
          `${nav.standalone === true} / mql:${window.matchMedia('(display-mode: standalone)').matches}`,
        ],
        ['screen.height', `${screen.height}`],
        ['innerHeight', `${window.innerHeight}`],
        ['doc.clientHeight', `${document.documentElement.clientHeight}`],
        ['visualVP.height', vv ? `${Math.round(vv.height)}` : 'n/a'],
        ['visualVP.offsetTop', vv ? `${Math.round(vv.offsetTop)}` : 'n/a'],
        ['100dvh', measureCss('100dvh')],
        ['100svh', measureCss('100svh')],
        ['100lvh', measureCss('100lvh')],
        ['100vh', measureCss('100vh')],
        ['safe-top', measureCss('env(safe-area-inset-top)')],
        ['safe-bottom', measureCss('env(safe-area-inset-bottom)')],
        ['dpr', `${window.devicePixelRatio}`],
        ['ua', navigator.userAgent.slice(0, 38)],
      ])
    }
    read()
    window.visualViewport?.addEventListener('resize', read)
    window.addEventListener('orientationchange', read)
    return () => {
      window.visualViewport?.removeEventListener('resize', read)
      window.removeEventListener('orientationchange', read)
    }
  }, [])

  return (
    <>
      {/* Panel de datos — arriba, no bloquea taps */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 99999,
          maxWidth: '70vw',
          background: 'rgba(0,0,0,0.88)',
          color: '#39FF14',
          font: '10px/1.35 ui-monospace, monospace',
          padding: '6px 8px',
          pointerEvents: 'none',
          whiteSpace: 'pre',
        }}
      >
        {rows.map(([k, v]) => `${k}: ${v}`).join('\n')}
      </div>

      {/* Marca de dónde cae position:fixed bottom:0 (línea roja). Si queda un
          hueco entre esta línea y el borde físico de la pantalla, el viewport
          no llega al fondo. */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 99999,
          height: '3px',
          background: 'red',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'fixed',
          right: 4,
          bottom: 4,
          zIndex: 99999,
          color: 'red',
          font: '10px/1 ui-monospace, monospace',
          pointerEvents: 'none',
        }}
      >
        fixed bottom:0
      </div>
    </>
  )
}
