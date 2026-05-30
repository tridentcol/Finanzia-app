'use client'

import { useEffect, type RefObject } from 'react'

type ChatViewportOptions = {
  containerRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
}

/**
 * Maneja el teclado virtual en el chat a pantalla completa sin mover el layout, y
 * con la BARRA SUPERIOR fija (problema clásico de iOS Safari/PWA).
 *
 * Lo medido en dispositivo real: iOS, al enfocar un input abajo, (1) panea/encoge
 * el viewport visible (`visualViewport.offsetTop` > 0, `height` baja), (2)
 * scrollea el documento, y (3) reporta los valores TARDE/escasos. Compensar el
 * paneo con `transform` siempre tiembla (el paneo va en el compositor; la
 * compensación en el hilo principal, con desfase). La única forma de que la barra
 * quede fija es que iOS NO panee.
 *
 * Estrategia:
 *  - SNAP directo: height = vv.height, transform = translate(offsetLeft, offsetTop).
 *  - APERTURA: al enfocar subimos el input de inmediato (encogemos al alto de
 *    teclado conocido + reflow forzado) ANTES de que iOS mida → iOS no panea →
 *    `offsetTop` queda en 0 y la barra superior no se mueve.
 *  - CIERRE: iOS reporta el crecimiento tarde, así que anticipamos pantalla
 *    completa de inmediato; el teclado nativo baja por encima → sin hueco.
 *  - Fondo del documento pintado del color del chat (bg-surface) → cualquier
 *    hueco transitorio es invisible.
 *  - Refuerzos: lock fuerte (`body { position: fixed }`) + `scrollTo(0,0)`,
 *    fijado al fondo del scroll, y poll por frame durante la animación.
 *
 * El breakpoint `sm` se chequea en vivo; en desktop limpia estilos y suelta todo.
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
      bodyBackground: body.style.background,
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
      // Fondo del color del chat → cualquier hueco transitorio es invisible.
      body.style.background = getComputedStyle(el).backgroundColor
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
      body.style.background = saved.bodyBackground
    }

    let pinUntil = 0
    let closingUntil = 0
    let openingUntil = 0
    let lastInset = 0 // último alto de teclado conocido

    const pinScroller = () => {
      const sc = scrollerRef.current
      if (!sc) return
      const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 64
      if (Date.now() < pinUntil || nearBottom) sc.scrollTop = sc.scrollHeight
    }
    const setBox = (height: number, offTop: number) => {
      el.style.height = `${height}px`
      el.style.transform = `translate(0px, ${offTop}px)`
    }

    const apply = () => {
      if (desktopMql.matches) {
        unlock()
        el.style.height = ''
        el.style.transform = ''
        return
      }
      lock()
      if (window.scrollY !== 0) window.scrollTo(0, 0)
      const inset = Math.max(0, Math.round(html.clientHeight - vv.height))
      if (inset > 0) lastInset = inset
      // CIERRE anticipado: pantalla completa ya (iOS reporta el crecimiento tarde).
      if (Date.now() < closingUntil && vv.height < html.clientHeight - 4) {
        setBox(html.clientHeight, 0)
        pinScroller()
        return
      }
      // APERTURA anticipada: mientras iOS aún no reporta el teclado, mantenemos el
      // input subido al alto conocido → iOS no panea → barra superior fija.
      if (Date.now() < openingUntil && inset === 0 && lastInset > 0) {
        setBox(html.clientHeight - lastInset, 0)
        pinScroller()
        return
      }
      setBox(vv.height, vv.offsetTop)
      pinScroller()
    }

    let frame = 0
    const schedule = () => {
      if (frame) return
      frame = window.requestAnimationFrame(() => {
        frame = 0
        apply()
      })
    }

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
      const now = Date.now()
      openingUntil = now + 400
      closingUntil = 0
      pinUntil = now + 700
      pollUntil = now + 700
      // Sube el input YA (con reflow forzado) antes de que iOS mida → sin paneo.
      if (!desktopMql.matches && lastInset > 0) {
        lock()
        setBox(html.clientHeight - lastInset, 0)
        void el.offsetHeight
        pinScroller()
      }
      poll()
    }
    const onFocusOut = () => {
      const now = Date.now()
      closingUntil = now + 650
      openingUntil = 0
      pollUntil = now + 750
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
