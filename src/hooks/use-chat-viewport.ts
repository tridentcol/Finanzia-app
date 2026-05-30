'use client'

import { useEffect, type RefObject } from 'react'

type ChatViewportOptions = {
  containerRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
}

/**
 * Ancla un chat a pantalla completa al viewport VISIBLE en mobile, para que el
 * teclado virtual no desplace el layout (problema clásico de iOS Safari/PWA).
 *
 * Medido en dispositivo real, iOS al enfocar el input:
 *  1. Panea y encoge el viewport visible (`visualViewport.offsetTop` > 0,
 *     `height` baja). `dvh/svh/lvh` NO reaccionan al teclado → se mide por JS.
 *  2. Scrollea el DOCUMENTO (`scrollY` > 0) para "revelar" el input, y
 *     `overflow:hidden` no lo frena → arrastra al contenedor `fixed` hacia arriba.
 *
 * El hook, en cada `apply()`, hace SNAP DIRECTO al viewport visible:
 *  - height    = visualViewport.height                  → mide exacto el área visible
 *  - transform = translate(offsetLeft, offsetTop)        → reancla al área visible
 *  - lock fuerte (`body { position: fixed }`) + `scrollTo(0,0)` → `scrollY` en 0
 *  - fija el scroll de mensajes al FONDO al enfocar (ves el último mensaje).
 *
 * Clave de fluidez: NO añadimos transición/amortiguación propia. El contenedor
 * mide SIEMPRE exactamente el área visible, así su borde inferior (el input)
 * queda pegado al tope del teclado sin retraso → nunca se ve el hueco vacío del
 * teclado al abrir/cerrar. La suavidad la da la animación NATIVA del teclado de
 * iOS; cualquier transición propia "persigue" al teclado con lag y genera ese
 * espacio feo. Para no perder ningún frame de la animación nativa, al
 * enfocar/desenfocar polleamos cada frame ~700ms (los eventos de iOS son
 * escasos). El breakpoint `sm` se chequea en vivo; en desktop limpia estilos.
 */
export function useChatViewport({ containerRef, scrollerRef }: ChatViewportOptions) {
  useEffect(() => {
    const el = containerRef.current
    const vv = window.visualViewport
    if (!el || !vv) return

    const desktopMql = window.matchMedia('(min-width: 640px)')
    const html = document.documentElement
    const body = document.body
    const saved = {
      htmlOverflow: html.style.overflow,
      bodyOverflow: body.style.overflow,
      bodyPosition: body.style.position,
      bodyTop: body.style.top,
      bodyLeft: body.style.left,
      bodyRight: body.style.right,
      bodyWidth: body.style.width,
    }

    let locked = false
    const lock = () => {
      if (locked) return
      locked = true
      html.style.overflow = 'hidden'
      body.style.position = 'fixed'
      body.style.top = '0'
      body.style.left = '0'
      body.style.right = '0'
      body.style.width = '100%'
      body.style.overflow = 'hidden'
    }
    const unlock = () => {
      if (!locked) return
      locked = false
      html.style.overflow = saved.htmlOverflow
      body.style.position = saved.bodyPosition
      body.style.top = saved.bodyTop
      body.style.left = saved.bodyLeft
      body.style.right = saved.bodyRight
      body.style.width = saved.bodyWidth
      body.style.overflow = saved.bodyOverflow
    }

    let pinUntil = 0
    const apply = () => {
      if (desktopMql.matches) {
        unlock()
        el.style.height = ''
        el.style.transform = ''
        return
      }
      lock()
      if (window.scrollY !== 0) window.scrollTo(0, 0)
      el.style.height = `${vv.height}px`
      el.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px)`
      const sc = scrollerRef.current
      if (sc) {
        const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 64
        if (Date.now() < pinUntil || nearBottom) sc.scrollTop = sc.scrollHeight
      }
    }

    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        apply()
      })
    }

    // Sigue la animación nativa del teclado frame a frame: pollea hasta
    // `pollUntil` (los eventos de iOS son escasos). `disposed` corta el loop.
    let pollUntil = 0
    let polling = false
    let disposed = false
    const poll = () => {
      if (polling) return
      polling = true
      const loop = () => {
        if (disposed) {
          polling = false
          return
        }
        apply()
        if (Date.now() < pollUntil) {
          window.requestAnimationFrame(loop)
        } else {
          polling = false
        }
      }
      window.requestAnimationFrame(loop)
    }

    const onFocusIn = () => {
      // Al abrir: fija el fondo (ver el último mensaje) y sigue el teclado denso.
      pinUntil = Date.now() + 700
      pollUntil = Date.now() + 700
      poll()
    }
    const onFocusOut = () => {
      pollUntil = Date.now() + 700
      poll()
    }

    apply()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)
    window.addEventListener('orientationchange', onFocusIn)
    return () => {
      disposed = true
      if (frame) window.cancelAnimationFrame(frame)
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('orientationchange', onFocusIn)
      unlock()
      el.style.height = ''
      el.style.transform = ''
    }
  }, [containerRef, scrollerRef])
}
