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
 * Medido en dispositivo real, iOS hace DOS cosas al enfocar el input:
 *  1. Panea el viewport visible (`visualViewport.offsetTop` > 0) y lo encoge
 *     (`visualViewport.height`). Las unidades `dvh/svh/lvh` NO reaccionan al
 *     teclado, así que hay que medir con `visualViewport` por JS.
 *  2. Scrollea el DOCUMENTO (`window.scrollY` > 0) para "revelar" el input — y
 *     `overflow:hidden` no lo frena. Eso arrastra al contenedor `fixed` hacia
 *     arriba (boxTop ≈ translateY − scrollY).
 *
 * El fix, en cada `apply()`:
 *  - height    = visualViewport.height                  → encoge desde abajo
 *  - transform = translate(offsetLeft, offsetTop)        → reancla al área visible
 *  - lock fuerte del documento (`body { position: fixed }`) + `scrollTo(0,0)` →
 *    deja `scrollY` en 0 para que el `fixed` no se arrastre.
 *
 * Y porque iOS dispara los eventos del visualViewport de forma temprana/escasa
 * (se queda latcheado un valor transitorio del teclado), re-aplicamos con varios
 * retrasos tras `focusin`/`focusout` para converger al estado YA asentado. El
 * breakpoint `sm` (640px) se chequea en vivo dentro de `apply()` — sin estado de
 * React — para no re-montar el effect a mitad de la animación del teclado; en
 * desktop limpia los estilos y suelta el lock.
 */
export function useChatViewport({ containerRef, scrollerRef }: ChatViewportOptions) {
  useEffect(() => {
    const el = containerRef.current
    const vv = window.visualViewport
    if (!el || !vv) return

    const isFullscreen = () => !window.matchMedia('(min-width: 640px)').matches
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

    let frame = 0
    const apply = () => {
      frame = 0
      if (!isFullscreen()) {
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
      if (sc && sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 64) {
        sc.scrollTop = sc.scrollHeight
      }
    }
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(apply)
    }

    // iOS dispara los eventos del visualViewport temprano/escaso al abrir o
    // cerrar el teclado; re-aplicamos con retrasos para capturar el estado YA
    // asentado en vez de un frame transitorio.
    let timers: number[] = []
    const settle = () => {
      timers.forEach((t) => window.clearTimeout(t))
      timers = [0, 60, 150, 300, 500].map((ms) => window.setTimeout(schedule, ms))
    }

    apply()
    vv.addEventListener('resize', schedule)
    vv.addEventListener('scroll', schedule)
    window.addEventListener('focusin', settle)
    window.addEventListener('focusout', settle)
    window.addEventListener('orientationchange', settle)
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      timers.forEach((t) => window.clearTimeout(t))
      vv.removeEventListener('resize', schedule)
      vv.removeEventListener('scroll', schedule)
      window.removeEventListener('focusin', settle)
      window.removeEventListener('focusout', settle)
      window.removeEventListener('orientationchange', settle)
      unlock()
      el.style.height = ''
      el.style.transform = ''
    }
  }, [containerRef, scrollerRef])
}
