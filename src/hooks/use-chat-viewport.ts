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
 * El hook hace SNAP DIRECTO al viewport visible (sin transición propia, que
 * "perseguía" al teclado con lag): height = visualViewport.height, transform =
 * translate(offsetLeft, offsetTop), + lock fuerte (`body { position: fixed }`) +
 * `scrollTo(0,0)`, + fija el scroll de mensajes al FONDO al enfocar.
 *
 * ABRIR: el contenedor mide exactamente el área visible cada frame, montado sobre
 * la animación nativa del teclado (que iOS reporta razonablemente al subir).
 *
 * CERRAR: iOS reporta el crecimiento del viewport TARDE, así que el contenedor se
 * quedaba chico mientras el teclado ya había bajado → se veía el hueco vacío. Por
 * eso ANTICIPAMOS el cierre: al soltar el foco llevamos el contenedor a pantalla
 * completa de inmediato (sin esperar a iOS); el teclado nativo baja por encima del
 * chat ya completo → cero hueco.
 *
 * Para no perder frames de la animación nativa, al enfocar/desenfocar polleamos
 * cada frame ~700ms (los eventos de iOS son escasos). El breakpoint `sm` se
 * chequea en vivo; en desktop limpia estilos y suelta el lock.
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
    let closingUntil = 0
    const pinScroller = () => {
      const sc = scrollerRef.current
      if (!sc) return
      const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 64
      if (Date.now() < pinUntil || nearBottom) sc.scrollTop = sc.scrollHeight
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
      // Cierre anticipado: mientras el teclado baja, iOS reporta el crecimiento
      // del viewport tarde (se vería el hueco). Forzamos pantalla completa hasta
      // que iOS se pone al día (vv.height alcanza el alto cerrado) o vence el tope
      // de tiempo — así la salida es continua, sin salto final.
      if (Date.now() < closingUntil && vv.height < html.clientHeight - 4) {
        el.style.height = `${html.clientHeight}px`
        el.style.transform = 'translate(0px, 0px)'
        pinScroller()
        return
      }
      el.style.height = `${vv.height}px`
      el.style.transform = `translate(${vv.offsetLeft}px, ${vv.offsetTop}px)`
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
      // Al abrir: cancela cualquier cierre anticipado, fija el fondo, sigue denso.
      closingUntil = 0
      pinUntil = Date.now() + 700
      pollUntil = Date.now() + 700
      poll()
    }
    const onFocusOut = () => {
      // Al cerrar: anticipa pantalla completa mientras el teclado nativo baja.
      const now = Date.now()
      closingUntil = now + 650
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
