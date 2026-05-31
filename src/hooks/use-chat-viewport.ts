'use client'

import { useEffect, type RefObject } from 'react'

type ChatViewportOptions = {
  containerRef: RefObject<HTMLDivElement | null>
  scrollerRef: RefObject<HTMLDivElement | null>
}

/**
 * Maneja el teclado virtual en el chat a pantalla completa con la BARRA SUPERIOR
 * fija (problema clásico de iOS Safari/PWA).
 *
 * Medido en dispositivo real al abrir el teclado, iOS hace DOS desplazamientos:
 *  - scrollea el DOCUMENTO (`window.scrollY` ~347), y
 *  - panea el viewport (`visualViewport.offsetTop` ~347).
 * Si dejas el body normal, AMBOS mueven el contenedor (se suman ≈694). Si peleas
 * el scroll con `scrollTo(0,0)`, iOS y tú rebotáis y la barra tiembla.
 *
 * La combinación correcta (la que clava la barra):
 *  1. `body { position: fixed }` → ABSORBE el scroll del documento: queda como un
 *     "fantasma" (reportado pero sin efecto visual). Así solo queda el paneo.
 *  2. NO pelear el scroll (sin `scrollTo`) → sin rebote.
 *  3. COMPENSAR solo el paneo: `transform: translate(0, offsetTop)`, aplicado de
 *     forma SINCRÓNICA en el evento de scroll/pan (sin esperar a rAF) → la barra
 *     queda en su sitio sin lag.
 * La altura (= `visualViewport.height`) se ajusta aparte; el cierre se anticipa a
 * pantalla completa; el fondo del documento va del color del chat (huecos
 * invisibles). El breakpoint `sm` se chequea en vivo; en desktop limpia estilos.
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
      bodyOverscroll: body.style.overscrollBehavior,
      bodyBackground: body.style.background,
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
      body.style.overscrollBehavior = 'none'
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
      body.style.overscrollBehavior = saved.bodyOverscroll
      body.style.background = saved.bodyBackground
    }

    let pinUntil = 0
    let closingUntil = 0
    const isClosing = () => Date.now() < closingUntil && vv.height < html.clientHeight - 4

    const pinScroller = () => {
      const sc = scrollerRef.current
      if (!sc) return
      const nearBottom = sc.scrollHeight - sc.scrollTop - sc.clientHeight <= 64
      if (Date.now() < pinUntil || nearBottom) sc.scrollTop = sc.scrollHeight
    }

    // Compensa el paneo SINCRÓNICAMENTE (clava la barra, sin lag ni rebote).
    const setTransform = () => {
      el.style.transform = isClosing() ? 'translate(0px, 0px)' : `translate(0px, ${vv.offsetTop}px)`
    }

    const apply = () => {
      if (desktopMql.matches) {
        unlock()
        el.style.height = ''
        el.style.transform = ''
        return
      }
      lock()
      el.style.height = `${isClosing() ? html.clientHeight : vv.height}px`
      setTransform()
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

    const onViewport = () => {
      setTransform()
      schedule()
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
      closingUntil = 0
      pinUntil = Date.now() + 700
      pollUntil = Date.now() + 700
      poll()
    }
    const onFocusOut = () => {
      closingUntil = Date.now() + 650
      pollUntil = Date.now() + 750
      poll()
    }

    apply()
    vv.addEventListener('resize', onViewport)
    vv.addEventListener('scroll', onViewport)
    window.addEventListener('scroll', setTransform, { passive: true })
    window.addEventListener('focusin', onFocusIn)
    window.addEventListener('focusout', onFocusOut)
    window.addEventListener('orientationchange', onFocusIn)
    return () => {
      disposed = true
      if (frame) window.cancelAnimationFrame(frame)
      vv.removeEventListener('resize', onViewport)
      vv.removeEventListener('scroll', onViewport)
      window.removeEventListener('scroll', setTransform)
      window.removeEventListener('focusin', onFocusIn)
      window.removeEventListener('focusout', onFocusOut)
      window.removeEventListener('orientationchange', onFocusIn)
      unlock()
      el.style.height = ''
      el.style.transform = ''
    }
  }, [containerRef, scrollerRef])
}
