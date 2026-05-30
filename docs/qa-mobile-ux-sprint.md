# QA visual — Sprint UX del copiloto (U1–U4)

> Creado 2026-05-29. El builder no puede renderizar la ruta autenticada (Clerk)
> headless, así que esta verificación visual queda para ti. Prueba en mobile real
> o DevTools a **320, 360, 390 y 430px**. Para los ítems de IA, primero abre el
> copiloto (Cmd+J o el FAB) y elige un **modelo de IA** en el selector (no "Local").

## U1 — Estado humano durante la generación

- [ ] Pregunta algo que use tools ("¿cómo va mi situación financiera?"): se ve una
      sola línea que cambia "Pensando…" → "Revisando tus movimientos…" /
      "Revisando tus cuentas…" → "Preparando tu respuesta…" y desaparece al llegar
      el texto, sin parpadeo del contenido.
- [ ] El punto a la izquierda es lavanda (`accent-ai`) y late suave; el texto es
      legible (no demasiado tenue). Una sola línea, sin desbordar en 320px.
- [ ] Pulsa **Detener** a media generación (o corta la red): el estado pasa a
      "No obtuve una respuesta." con un punto estático neutro — NO se queda
      latiendo "Preparando tu respuesta…".
- [ ] Con `prefers-reduced-motion: reduce` (DevTools → Rendering): el punto queda
      estático y el cambio de frase es instantáneo.
- [ ] Motor "Local" (heurístico): sigue mostrando "Pensando…" sin regresión.

## U2 — Markdown de respuestas (sólo con IA)

- [ ] Pide un paso a paso ("dame los pasos para armar un fondo de emergencia"):
      se ve como **ítems numerados** con el número en Geist Mono alineado en
      columna, no un párrafo corrido.
- [ ] Una lista de ítems usa viñetas sobrias (·), no `list-disc` nativo.
- [ ] La negrita resalta cifras/términos con discreción; la cursiva es Inter (no
      Fraunces). Cero emojis, cero tablas innecesarias, sin colores de acento en
      el cuerpo del mensaje.

## U3 — Layout mobile (sólo <768px; desktop debe quedar igual)

- [ ] Bottom-nav: **Hoy · Mi dinero · [◆ FAB lavanda] · Mi plan · Mi historia**.
      No existe el botón "Más".
- [ ] El FAB central (lavanda) abre el **copiloto**; nunca muestra barra de
      sección activa. Los 4 links sí muestran el indicador morado cuando activos.
- [ ] Topbar: **Registrar** (morado) abre "Nueva transacción"; **Buscar**, la
      **campana** y el **avatar** son tappables (≥44×44). "Preguntar" ya no está
      en el topbar móvil.
- [ ] El **avatar** abre un sheet inferior con Ajustes / Categorías /
      Integraciones IA / Importar CSV + tu cuenta (UserButton). El sheet se cierra
      al tocar un destino.
- [ ] **320px**: las 4 etiquetas del bottom-nav caben (revisa "Mi historia"); el
      título del topbar (p.ej. "Mi dinero · Movimientos") se trunca sin empujar
      los botones del cluster.
- [ ] PWA iOS (añadir a inicio): el bottom-nav no choca con la home indicator; el
      topbar respeta el notch. Indicador activo correcto en las 4 secciones.

## U4 — Onboarding profundo + personalización

- [ ] Con un usuario sin onboarding, el wizard aparece. Son ~10 pantallas, una
      decisión por pantalla; barra de progreso arriba.
- [ ] Navegación **Atrás/Continuar** conserva lo elegido. En "Tu meta de ahorro",
      "Continuar" está deshabilitado hasta elegir un método (y, si es "Monto fijo",
      hasta escribir un monto válido).
- [ ] En los pasos de personalización, el primario dice **"Omitir"** mientras no
      elijas nada y **"Continuar"** al elegir. "Configurar más tarde" cierra el
      wizard.
- [ ] **Mini-test** "Cómo te relacionas con tu dinero": 3 sub-pantallas con 3
      puntos de mini-progreso. Enmarcado como "no es un test de personalidad".
- [ ] **Mobile 320–430px**: la barra de progreso NO queda bajo el notch; el footer
      (Atrás/Continuar) NO choca con la home indicator; no hay hueco vacío bajo el
      footer; si el contenido no cabe, scrollea dentro del sheet.
- [ ] Cierre en Fraunces italic, sin ilustración.
- [ ] Lector de pantalla: el diálogo se anuncia con nombre (el headline de cada
      paso), no como "diálogo sin etiqueta".

### Personalización observable (requiere un modelo de IA con key)

- [ ] Completa el onboarding con **Conocimiento: básico** y pregunta algo con un
      término técnico (p.ej. "¿cómo está mi flujo de caja?"): el copiloto **define**
      el término. Repite con **Avanzado**: no lo define.
- [ ] Con **Estilo: directo** la respuesta es más corta que con **Detallado**.
- [ ] Edita en **Ajustes → Perfil financiero → "Cómo te habla el copiloto"**
      (chips de conocimiento/estilo/relación/horizonte/foco máx 2), guarda, y
      verifica que la **siguiente** respuesta del copiloto lo refleja.
