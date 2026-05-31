# Arranque de sesión — Enriquecer Finanzia (UX del copiloto · fluidez · nuevas funcionalidades)

> Handoff para una **sesión nueva**. La auditoría (Fases 0–5) ya se ejecutó y la DB de prod
> quedó reconciliada — ver `docs/AUDIT-findings.md`, `docs/AUDIT-NEXT-SESSION.md` y la memoria
> del proyecto. Esta sesión es para **3 frentes nuevos**. `CLAUDE.md` es ley (Mandato Noir +
> reglas no negociables). Antes de tocar algo: leé este doc y el código citado; no re-audites.

## Estado del proyecto (mínimo para arrancar)

Finanzia: finanzas personales con IA. Next.js 16 (App Router), TS strict, Tailwind v4,
shadcn/ui, Supabase + Drizzle, Clerk, Vercel AI SDK (OpenAI default `gpt-5.4-mini` + embeddings;
Claude en fallback de categorización e insights). Single-user MVP, multi-tenant ready. COP/USD
multi-divisa. Mandato **Noir**. `pnpm lint` 0 errores, `pnpm typecheck` limpio, `pnpm build`
verde, 86 tests. Working tree: solo `docs/llm-openai-integration-plan.md` untracked.

Pendiente operativo (no bloquea): seed del copiloto (`scripts/seed-intent-examples.ts`, espera
saldo OpenAI → `intent_examples` vacía, el copiloto degrada a keyword).

---

## Frente A — Tono del copiloto accesible (UX, esfuerzo S–M)

**Qué quiere el usuario:**
1. Que la sección **"Cómo te habla el copiloto"** se abra **automáticamente la primera vez** que
   se entra a `/copilot`.
2. Un **botón con ícono de parámetros** (sliders/ecualizador, **NO** la tuerca de settings) en la
   barra del copiloto ("Finanzia"), **a la derecha**, al lado del selector de modelo de IA, que
   lleve a esa configuración para modular el tono fácilmente y la deje accesible.

**Estado actual (archivos):**
- `src/app/(app)/ajustes/perfil-financiero/copilot-tone-card.tsx` — `CopilotToneCard`, componente
  cliente autocontenido. Edita literacy / commStyle / **moneyStyle** / horizon / focus con
  `ChipGroup`s y persiste vía `updateFinancialPersona` (merge en `aiProfile.persona`). **Reusable.**
- `src/components/app/copilot-chat.tsx` — header del copiloto. A la izquierda: back, sparkle,
  "Finanzia", `CopilotEngineMenu`. A la derecha (header es `justify-between`): hoy solo el botón
  "Limpiar" cuando hay mensajes. El botón de tono va a la derecha.
- `src/components/copilot/engine-menu.tsx` — patrón del selector (DropdownMenu radix) a imitar.
- `src/lib/design/icons.ts` — lista curada. **Falta el ícono de parámetros**: añadir
  `SlidersHorizontal` de lucide (key sugerida `sliders`). Hoy solo está `filter`.

**Enfoque sugerido (a decidir en sesión):**
- **Botón → Sheet/Dialog** que monta `<CopilotToneCard>` (no navegar a Ajustes; más fluido y
  "queda accesible"). Reusar el Sheet Noir existente. El botón usa `icons.sliders` (a añadir),
  lavanda `accent-ai` (presencia IA), `aria-label="Ajustar cómo te habla"`.
- **Auto-abrir la primera vez:** flag persistente. Opción limpia: `aiProfile.copilot.toneIntroSeen`
  (server, cross-device) seteado al cerrar el sheet la 1ª vez; el `/copilot` lo lee del perfil
  (ya carga `aiProfile`). Alternativa rápida: `localStorage` (per-device). Preferir el flag en
  perfil por consistencia con el resto de `aiProfile`.
- Respetar regla 6 (esto es config de tono, no muta datos) y Noir (sin tuerca, sin glow).
- **No** abrir el teclado en mobile al auto-abrir el sheet (el teclado del copiloto fue un pase
  delicado — ver memoria `project-copilot-mobile-keyboard`). El sheet de tono no tiene inputs de
  texto, así que debería estar bien; verificar en mobile.

---

## Frente B — Navegación fluida (rendimiento, esfuerzo M — apuesta estratégica)

**Síntoma (usuario):** entrar a cada sección es lento (desktop y mobile); hay que esperar la carga
y se pierde fluidez. Las View Transitions aterrizan sobre render no cacheado.

**Causa raíz (auditoría, Perf #1/#2):** cero primitivas de caché de Next 16. Toda ruta `(app)/*`
es dinámica (auth Clerk + `cookies()` + N queries Postgres por request). `getProfile` ya está
memoizado por request (React `cache()`), pero no hay caché cross-request ni PPR. Esto es la
**apuesta estratégica diferida** — necesita la app corriendo para verificar streaming/auth/RLS.

**Plan por capas (de menor a mayor riesgo):**
1. **Quick wins sin cacheComponents:**
   - `cacheLife`/`unstable_cache` (o `use cache` si se activa el flag) sobre lecturas **estables**:
     categorías de sistema, tasas del día (`getRatesForPairs`), `profile-snapshot`. Invalidar con
     `cacheTag`/`revalidateTag` desde las Server Actions que las cambian.
   - Asegurar `prefetch` en toda navegación (SectionTabs ya prefetchea; revisar rail/mobile-nav).
   - Confirmar que los `loading.tsx` (ya existen) den feedback instantáneo — el problema no es el
     skeleton, es el TTFB del RSC dinámico.
2. **PPR / Cache Components (el salto):** activar `experimental.cacheComponents`, prerenderizar el
   **shell** (layout, rail, topbar, headers de sección) y **streamear los datos** en `<Suspense>`
   con skeletons Noir. Migrar ruta por ruta. La View Transition aterriza sobre shell ya pintado →
   sensación instantánea.
   - **Riesgo:** cacheComponents obliga a que toda lectura dinámica (auth, cookies, DB) viva en
     `<Suspense>` o el build falla. Es migración app-wide (~24 rutas + layout). **Verificar con la
     app corriendo:** redirects de auth, RLS, View Transitions, el teclado mobile del copiloto.
   - Hacerlo incremental y con `pnpm dev` + `pnpm build` en cada paso; no en batch a ciegas.
3. **Medir:** Lighthouse / `next build` analyze antes y después; la auditoría nunca midió CWV reales.

Doc útil: skill `vercel:next-cache-components` (PPR, `use cache`, cacheLife/Tag, migración de
`unstable_cache`).

---

## Frente C — Enriquecer funcionalidades (exploración — el grueso de la sesión)

> El usuario quiere **explorar y proponer** nuevas funcionalidades que hagan a Finanzia
> *realmente diferenciadora*, además de terminar de pulir lo existente. Esto es un proceso de
> producto, no una lista a ejecutar a ciegas: **explorar → proponer con impacto×esfuerzo×
> diferenciación → elegir junto al usuario → construir verificando**.

### Inventario de lo que YA existe (para no reinventar)
- **Cuentas** (líquidas, inversión, efectivo, cripto) + **tarjetas de crédito**
  (`accounts.type='credit_card'` + `credit_card_profiles` + identidad visual + analizador de
  compra a cuotas) + **deudas** (préstamos/hipoteca/etc., con gestión completa).
- **Transacciones** multi-divisa con `amount_base` exacto (BigInt), **auto-categorización**
  (kNN sobre embeddings 1536d + reglas de merchant + fallback LLM con few-shot de tus
  correcciones) + búsqueda literal y **semántica (RAG)**.
- **Presupuestos**, **metas**, **plan de ahorro** + períodos mensuales, **recurrentes** (con
  detección de drift), **cash-flow proyectado** a 90 días (+ volatilidad), **patrimonio neto**.
- **Insights** (detectores: gasto hormiga, drift de recurrentes, anomalías, espejo de alertas…)
  + **reportes mensuales** (resumen + hábitos por LLM).
- **Copiloto** (motor local determinista + LLM con tools de lectura/propuesta; regla 6: propone,
  la UI confirma) con persona/tono personalizada.
- **Ingesta:** import CSV + email bancario (Resend), idempotentes. **Alertas** accionables.

### Cómo pensar la diferenciación (framing, no prescripción)
Filtros para evaluar cada idea:
1. **¿Resuelve un dolor real recurrente** que las apps de finanzas LATAM no resuelven bien?
2. **¿Apalanca lo que ya tenemos** (embeddings, copiloto, multi-divisa, insights) en vez de
   construir de cero?
3. **¿Es "más caro/editorial"** (mandato #15) y no un dashboard genérico más?
4. **¿Respeta regla 6** (IA no muta sin confirmación) y la postura de privacidad (PII no sale a
   entrenamiento)?
5. **Impacto × esfuerzo × riesgo** — preferir lo que mueve la aguja con infra existente.

### Semillas para explorar (evaluar, no ejecutar tal cual)
- **Copiloto proactivo:** digest semanal / "money check-in" que empuja insights (hoy son
  pull). Nudges accionables, sin spam.
- **What-if / escenarios:** extender el analizador de compra a metas/runway — "si recorto X en
  Y, ¿cuándo llego a mi meta?", "¿me alcanza para Z?".
- **Patrimonio en el tiempo:** hoy es snapshot; tendencia + composición histórica.
- **Auto-reglas aprendidas:** convertir las correcciones (`userCorrected`, ya alimentan el
  few-shot) en reglas explícitas merchant→categoría que el usuario revisa.
- **Suscripciones inteligentes:** detección + aviso de subida de precio / cancelación.
- **Modo hogar/compartido:** la infra ya es multi-tenant ready.
- **Captura de recibos (OCR) → transacción.** **Ahorro automatizado** por reglas.
- **Salud financiera explicada** (score con el porqué, no un número opaco).
- **Helpers tributarios LATAM** (DIAN) · **modo viaje** multi-divisa.
- **El salto grande:** agregación bancaria real (Belvo/Finerio) — alto valor, alta complejidad
  LATAM; evaluar aparte.

### Pulir lo existente (detalles pendientes ya identificados)
- Frente A (tono del copiloto, arriba).
- Higiene: extraer ~14 archivos >300 líneas (cash-flow/page, movimientos page/actions,
  categorize, dialogs) — de a uno, con app corriendo.
- Flujos #8: header denso de movimientos (agrupar secundarias en overflow mobile, validar 360px).
- Residual baja-severidad restante en `docs/AUDIT-findings.md`.

---

## Reglas no negociables (de `CLAUDE.md`) al ejecutar
- **Mandato Noir es ley.** Cero emojis/gradientes/glow/saturación. Números Geist Mono tabular.
  Lavanda `accent-ai` solo IA; morados de marca solo identidad. Tuerca ≠ parámetros (el usuario
  pidió explícitamente el ícono de sliders, no settings).
- **Regla 6:** el LLM nunca muta sin confirmación UI.
- Toda mutación valida con Zod · respuesta `{ok,data}|{ok,error}` · estados loading/error/empty ·
  ≤300 líneas/archivo (lint warn) · `env` vía `src/lib/env.ts` · números siempre tabular.
- **El push lo hace el usuario.** Commit por cambio. Trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

---

## Prompt para pegar en la sesión nueva

```
Vamos a enriquecer Finanzia en 3 frentes. El plan completo está en
docs/ENRICH-NEXT-SESSION.md (leelo entero) y el estado del proyecto + auditoría ya ejecutada
en la memoria y docs/AUDIT-findings.md. CLAUDE.md es ley (Mandato Noir + reglas no negociables).
NO re-audites.

Frente A (empezar acá, esfuerzo S–M): hacer accesible el tono del copiloto. (1) botón con ícono
de parámetros (sliders, NO la tuerca de settings — añadir SlidersHorizontal a la lista curada de
iconos) en la barra del copiloto, a la DERECHA, al lado del selector de modelo, que abra un
sheet/dialog con CopilotToneCard (reusar el componente existente); (2) que ese sheet se abra
automáticamente la primera vez que se entra a /copilot (flag en aiProfile.copilot, server). Sin
abrir el teclado mobile.

Frente B (rendimiento, apuesta M): la navegación entre secciones es lenta porque todo (app)/* es
dinámico sin caché. Plan por capas en el doc: primero quick wins (cachear lecturas estables con
cacheTag invalidado por Server Actions), luego PPR/Cache Components (shell prerenderizado + datos
en Suspense). Verificar SIEMPRE con pnpm dev + pnpm build; es migración app-wide, no a ciegas.

Frente C (exploración de producto, el grueso): explorar y PROPONER nuevas funcionalidades
diferenciadoras + pulir lo existente. Usá el inventario y el framing del doc. Proponé con
impacto×esfuerzo×diferenciación y elegimos juntos antes de construir. No ejecutes features sin
acordarlas.

Para cada cambio: lint + typecheck (+ test si toca lógica) + build, y commit individual con el
trailer Co-Authored-By de Claude Opus 4.8. No hagas push (lo hago yo). Si algo necesita la app
corriendo para verificar (Frente B sobre todo), decímelo.

Arrancá por el Frente A: leé copilot-chat.tsx, copilot-tone-card.tsx, engine-menu.tsx e icons.ts,
proponé el diseño (sheet vs dialog, dónde el flag) y luego implementá.
```
