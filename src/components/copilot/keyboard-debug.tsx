'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * OVERLAY TEMPORAL DE DIAGNÓSTICO — BORRAR tras capturar los datos.
 *
 * Imprime en vivo lo que hace iOS al enfocar el input, para decidir el fix del
 * teclado con números reales del dispositivo en vez de teoría. Se ancla al
 * viewport VISIBLE (translateY(offsetTop)) para seguir legible con el teclado
 * abierto; si AÚN así se va de pantalla, eso mismo es el dato (la compensación
 * de offsetTop no basta en ese iOS). `pointer-events-none` para no robar taps.
 * Va por `createPortal` a <body> para no quedar atrapado por el `transform` del
 * contenedor del chat (un `fixed` dentro de un ancestro transformado se ancla a
 * ese ancestro, no al viewport).
 *
 * Las claves a leer: ¿`offTop` se vuelve > 0 al enfocar (iOS panea)? ¿`scrollY`
 * se mueve (iOS scrollea el documento pese al lock)? ¿disparan los eventos (r/s)?
 */
type Snapshot = {
  tag: string
  resize: number
  scroll: number
  vvHeight: number
  vvOffsetTop: number
  peakOffsetTop: number
  vvPageTop: number
  vvScale: number
  innerHeight: number
  clientHeight: number
  scrollY: number
  peakScrollY: number
  standalone: string
  displayMode: string
  boxTop: number
  boxHeight: number
}

export function KeyboardDebug({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const meta = useRef({ resize: 0, scroll: 0, tag: 'init', peakOffsetTop: 0, peakScrollY: 0 })
  const [snap, setSnap] = useState<Snapshot | null>(null)
  const [mounted, setMounted] = useState(false)

  // Diferido un frame: evita el throw de createPortal en SSR (document aún no
  // existe) sin hacer setState síncrono dentro del effect.
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    let frame = 0

    const read = (): Snapshot => {
      const rect = targetRef.current?.getBoundingClientRect()
      const nav = navigator as Navigator & { standalone?: boolean }
      const offTop = vv ? vv.offsetTop : 0
      meta.current.peakOffsetTop = Math.max(meta.current.peakOffsetTop, offTop)
      meta.current.peakScrollY = Math.max(meta.current.peakScrollY, window.scrollY)
      return {
        tag: meta.current.tag,
        resize: meta.current.resize,
        scroll: meta.current.scroll,
        vvHeight: vv ? Math.round(vv.height) : -1,
        vvOffsetTop: Math.round(offTop),
        peakOffsetTop: Math.round(meta.current.peakOffsetTop),
        vvPageTop: vv ? Math.round(vv.pageTop) : -1,
        vvScale: vv ? Number(vv.scale.toFixed(2)) : -1,
        innerHeight: Math.round(window.innerHeight),
        clientHeight: Math.round(document.documentElement.clientHeight),
        scrollY: Math.round(window.scrollY),
        peakScrollY: Math.round(meta.current.peakScrollY),
        standalone: nav.standalone === undefined ? '?' : String(nav.standalone),
        displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
        boxTop: rect ? Math.round(rect.top) : -1,
        boxHeight: rect ? Math.round(rect.height) : -1,
      }
    }

    const apply = () => {
      frame = 0
      const box = boxRef.current
      if (box && vv) box.style.transform = `translateY(${vv.offsetTop}px)`
      setSnap(read())
    }
    const schedule = (tag: string) => {
      meta.current.tag = tag
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    const onResize = () => {
      meta.current.resize += 1
      schedule('resize')
    }
    const onScroll = () => {
      meta.current.scroll += 1
      schedule('scroll')
    }
    const onFocusIn = () => schedule('focusin')
    const onFocusOut = () => schedule('focusout')

    apply()
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', onScroll)
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', onScroll)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
    }
  }, [targetRef])

  if (!mounted) return null

  return createPortal(
    <div
      ref={boxRef}
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] space-y-0.5 px-2 py-1.5 font-mono text-[10px] leading-tight"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)', color: '#9BE3C2' }}
    >
      {snap ? (
        <>
          <div>{`dm=${snap.displayMode} sa=${snap.standalone}  evt=${snap.tag}  r=${snap.resize} s=${snap.scroll}`}</div>
          <div>{`vv.h=${snap.vvHeight}  offTop=${snap.vvOffsetTop}  peakOffTop=${snap.peakOffsetTop}`}</div>
          <div>{`scrollY=${snap.scrollY}  peakScrollY=${snap.peakScrollY}  pageTop=${snap.vvPageTop}`}</div>
          <div>{`innerH=${snap.innerHeight}  clientH=${snap.clientHeight}  scale=${snap.vvScale}`}</div>
          <div>{`boxTop=${snap.boxTop}  boxH=${snap.boxHeight}`}</div>
        </>
      ) : (
        <div>init</div>
      )}
    </div>,
    document.body,
  )
}
