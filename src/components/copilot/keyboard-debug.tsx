'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * OVERLAY TEMPORAL DE DIAGNÓSTICO — BORRAR tras capturar los datos.
 *
 * Sonda CONTINUA (un rAF que corre cada frame, no por intervalo) para no perder
 * el instante en que algo scrollea. Registra los PICOS de todo lo que podría
 * mover la página/barra al abrir el teclado: scroll del documento, scroll del
 * contenedor, scroll del scroller interno, paneo del visualViewport y el rango
 * de la posición del contenedor. Va arriba-derecha y pequeña para no tapar
 * "Finanzia" (izquierda). Portal a <body>.
 */
type Snap = {
  offTopPk: number
  winYpk: number
  docYpk: number
  elTopPk: number
  scTopPk: number
  boxMin: number
  boxMax: number
  bodyPos: string
}

export function KeyboardDebug({
  targetRef,
  scrollerRef,
}: {
  targetRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
}) {
  const peak = useRef({ offTop: 0, winY: 0, docY: 0, elTop: 0, scTop: 0, boxMin: 0, boxMax: 0 })
  const [snap, setSnap] = useState<Snap | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    let raf = 0
    let frames = 0
    const loop = () => {
      const el = targetRef.current
      const sc = scrollerRef.current
      const p = peak.current
      const doc = document.scrollingElement
      p.offTop = Math.max(p.offTop, vv ? vv.offsetTop : 0)
      p.winY = Math.max(p.winY, window.scrollY)
      p.docY = Math.max(p.docY, doc ? doc.scrollTop : 0)
      p.elTop = Math.max(p.elTop, el ? el.scrollTop : 0)
      p.scTop = Math.max(p.scTop, sc ? sc.scrollTop : 0)
      if (el) {
        const top = el.getBoundingClientRect().top
        p.boxMin = Math.min(p.boxMin, top)
        p.boxMax = Math.max(p.boxMax, top)
      }
      frames += 1
      if (frames % 4 === 0) {
        setSnap({
          offTopPk: Math.round(p.offTop),
          winYpk: Math.round(p.winY),
          docYpk: Math.round(p.docY),
          elTopPk: Math.round(p.elTop),
          scTopPk: Math.round(p.scTop),
          boxMin: Math.round(p.boxMin),
          boxMax: Math.round(p.boxMax),
          bodyPos: getComputedStyle(document.body).position,
        })
      }
      raf = window.requestAnimationFrame(loop)
    }
    raf = window.requestAnimationFrame(loop)
    return () => window.cancelAnimationFrame(raf)
  }, [targetRef, scrollerRef])

  if (!mounted) return null

  return createPortal(
    <div
      className="pointer-events-none fixed top-0 right-0 z-[9999] space-y-0.5 px-2 py-1.5 text-right font-mono text-[10px] leading-tight"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', color: '#9BE3C2' }}
    >
      {snap ? (
        <>
          <div>{`body=${snap.bodyPos}`}</div>
          <div>{`winY=${snap.winYpk} docY=${snap.docYpk}`}</div>
          <div>{`elTop=${snap.elTopPk} scTop=${snap.scTopPk}`}</div>
          <div>{`offTop=${snap.offTopPk}`}</div>
          <div>{`box=${snap.boxMin}..${snap.boxMax}`}</div>
        </>
      ) : (
        <div>init</div>
      )}
    </div>,
    document.body,
  )
}
