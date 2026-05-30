'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'

/**
 * OVERLAY TEMPORAL DE DIAGNÓSTICO — BORRAR tras capturar los datos.
 *
 * Enfocado en la barra superior: mide la posición REAL del contenedor del chat
 * (`boxTop` = dónde está su borde superior en pantalla) y el paneo de iOS
 * (`offTop`), en vivo y con mín/máx, durante abrir/cerrar el teclado. Si `boxTop`
 * se aleja de 0, la barra se está moviendo y por cuánto; si `offTop` no vuelve a
 * 0, iOS deja el viewport paneado. Eso dice si el header se puede fijar o es
 * límite de Safari. Va por portal a <body> para no quedar bajo el transform.
 */
type Snap = {
  resize: number
  scroll: number
  vvHeight: number
  offTop: number
  offTopPeak: number
  scrollY: number
  boxTop: number
  boxTopMin: number
  boxTopMax: number
  standalone: string
  displayMode: string
}

export function KeyboardDebug({ targetRef }: { targetRef: RefObject<HTMLDivElement | null> }) {
  const meta = useRef({ resize: 0, scroll: 0, offTopPeak: 0, boxTopMin: 0, boxTopMax: 0 })
  const [snap, setSnap] = useState<Snap | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setMounted(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    let frame = 0
    const read = (): Snap => {
      const rect = targetRef.current?.getBoundingClientRect()
      const nav = navigator as Navigator & { standalone?: boolean }
      const offTop = vv ? vv.offsetTop : 0
      const boxTop = rect ? rect.top : 0
      meta.current.offTopPeak = Math.max(meta.current.offTopPeak, offTop)
      meta.current.boxTopMin = Math.min(meta.current.boxTopMin, boxTop)
      meta.current.boxTopMax = Math.max(meta.current.boxTopMax, boxTop)
      return {
        resize: meta.current.resize,
        scroll: meta.current.scroll,
        vvHeight: vv ? Math.round(vv.height) : -1,
        offTop: Math.round(offTop),
        offTopPeak: Math.round(meta.current.offTopPeak),
        scrollY: Math.round(window.scrollY),
        boxTop: Math.round(boxTop),
        boxTopMin: Math.round(meta.current.boxTopMin),
        boxTopMax: Math.round(meta.current.boxTopMax),
        standalone: nav.standalone === undefined ? '?' : String(nav.standalone),
        displayMode: window.matchMedia('(display-mode: standalone)').matches ? 'standalone' : 'browser',
      }
    }
    const apply = () => {
      frame = 0
      setSnap(read())
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }
    const onResize = () => {
      meta.current.resize += 1
      schedule()
    }
    const onScroll = () => {
      meta.current.scroll += 1
      schedule()
    }
    apply()
    vv?.addEventListener('resize', onResize)
    vv?.addEventListener('scroll', onScroll)
    window.addEventListener('focusin', schedule)
    window.addEventListener('focusout', schedule)
    let tick = 0
    const id = window.setInterval(() => {
      tick += 1
      schedule()
      if (tick > 600) window.clearInterval(id)
    }, 100)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.clearInterval(id)
      vv?.removeEventListener('resize', onResize)
      vv?.removeEventListener('scroll', onScroll)
      window.removeEventListener('focusin', schedule)
      window.removeEventListener('focusout', schedule)
    }
  }, [targetRef])

  if (!mounted) return null

  return createPortal(
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[9999] space-y-0.5 px-2 py-1.5 font-mono text-[10px] leading-tight"
      style={{ backgroundColor: 'rgba(0,0,0,0.82)', color: '#9BE3C2' }}
    >
      {snap ? (
        <>
          <div>{`dm=${snap.displayMode} sa=${snap.standalone}  r=${snap.resize} s=${snap.scroll}`}</div>
          <div>{`vv.h=${snap.vvHeight}  offTop=${snap.offTop}  peak=${snap.offTopPeak}`}</div>
          <div>{`scrollY=${snap.scrollY}`}</div>
          <div>{`BOXTOP=${snap.boxTop}  min=${snap.boxTopMin}  max=${snap.boxTopMax}`}</div>
        </>
      ) : (
        <div>init</div>
      )}
    </div>,
    document.body,
  )
}
