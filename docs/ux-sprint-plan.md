# Finanzia — Plan de Sprint UX del Copiloto y la App

> Creado 2026-05-29. Documento vivo: si una fase contradice este archivo tras implementarse, se actualiza el archivo.
>
> **ESTADO (2026-05-29): U1–U4 ✅ implementadas.** Una revisión adversarial por fase, hallazgos corregidos. Ver `docs/PROGRESS.md` (filas U1–U4) y el QA visual pendiente en `docs/qa-mobile-ux-sprint.md`. Desvíos del plan ya reconciliados: rutas IA v2 (`/mi-dinero`·`/mi-plan`·`/mi-historia`), topbar mantuvo 56px (los 44px caben; no se tocó `--topbar-total`), Importar quedó en el account sheet (sin CTA contextual aún), wizard en ~10 pantallas (mini-test = 3 sub).
>
> **Contexto previo** (ver `docs/PROGRESS.md` Step 19 + `docs/copilot-llm.md`): el LLM (OpenAI gpt-5.4-mini) ya es el cerebro del copiloto — lee todos los datos del usuario vía tools + `queryTransactions`, responde como asesor con un *profile snapshot*, confirma mutaciones con tarjeta, y el usuario elige el motor (Local por default / un modelo de IA con key) desde un selector discreto en el header del copiloto. **Este sprint es 100% experiencia de usuario**, sobre esa base ya funcional.

## Objetivo

Cinco frentes de UX, priorizando en todo momento una experiencia limpia, fluida y armónica, bajo el **mandato Noir** (CLAUDE.md): cero emojis, cero gradientes/glow/shimmer, números Geist Mono tabular, lavanda `accent-ai` SOLO para presencia de IA, morados de marca solo en detalles, "más caro que amigable", mobile compacto y minimalista.

1. **Feedback de generación humano** — el copiloto solo muestra tres puntos mientras genera; queremos un estado humano y discreto que comunique qué está haciendo.
2. **Formato de respuestas** — el LLM devuelve markdown (listas, pasos) que hoy se aplana en un párrafo; renderizarlo limpio.
3. **Layout mobile** — eliminar la pantalla "Más" (esconde funcionalidades) y dar protagonismo al copiloto (FAB central), moviendo "Registrar" al topbar con touch targets ≥44px.
4. **Onboarding de alto impacto** — capturar un perfil detallado (riesgo, personalidad financiera, metas, horizonte, conocimiento) que personalice de verdad las respuestas.

## Principios

- **UX primero.** Cada cambio debe sentirse más limpio y fluido, no solo "funcionar".
- **Sin migraciones SQL.** Todo lo de datos vive en `profiles.aiProfile` (jsonb). Validar con Zod en el server; nunca confiar en el cliente.
- **Honestidad.** No hay fine-tuning real del modelo: la personalización es por prompt (snapshot + hints de tono). Nada de pseudo-psicología.
- **El camino heurístico (sin IA) no se toca** salvo donde se indique: sigue con bloques estructurados del `answer-ast`.
- **Validación por fase:** `pnpm typecheck` (exit real) tras cada commit; `typecheck && lint && test && build` al cerrar cada fase. Sin `any`/`eslint-disable`/`ts-expect-error`/`--no-verify`. Componentes ≤300 líneas, imports `@/`, sin barrel exports.
- **Revisión adversarial** (workflow) del diff de cada fase antes de cerrarla, como se hizo en el Step 19.

## Prioridad y secuencia recomendada

Orden por impacto/esfuerzo, agrupando quick-wins del chat primero:

| Fase | Área | Esfuerzo | Riesgo | Por qué en este orden |
|---|---|---|---|---|
| **U1** | Feedback de generación | S–M (~0.5 día) | Bajo | Quick win del chat, 100% cliente, sin deps. Resuelve una queja directa. |
| **U2** | Formato markdown | ~0.5 día | Bajo | Quick win del chat. Añade 2 deps livianas. Mejora visible en cada respuesta. |
| **U3** | Layout mobile | 0.5–1 día | Medio | Shell mobile; accesibilidad + protagonismo del copiloto. Pura UI. |
| **U4** | Onboarding profundo | 1.5–2 días | Medio | El más grande; alimenta personalización. Se beneficia de U2 (las respuestas personalizadas se ven mejor). |

`queryTransactions` etiquetado como "Revisando tus movimientos…" en U1 conecta con U4 (consejo personalizado). U2 antes de U4 para que el consejo más rico se renderice bien.

---

## Fase U1 — Feedback humano durante la generación (tool-aware status)

### Objetivo
Reemplazar el indicador de "tres puntos" mudo por un estado humano y discreto que comunique *qué* está haciendo Finanzia. Mapear los tool-calls del stream (`message.parts` tipo `tool-<nombre>` con `state: input-available | output-available`) a etiquetas es-CO, con transición suave y acento lavanda mínimo, respetando `prefers-reduced-motion`. Noir intacto: sin emojis, sin spinner gritón, sin shimmer.

### Diseño (UX + comportamiento)
**Jerarquía de fases** sobre el último mensaje assistant en streaming:
1. **Trabajando un tool** — hay un part `tool-*` con `state` `input-available`/`input-streaming` → etiqueta de ese tool (gana el último del array).
2. **Tool resuelto, redactando** — todos los tools en `output-available`, sin texto aún → "Preparando tu respuesta…".
3. **Sin tools, sin texto** — "Pensando…".
4. **Llega texto** — el turno deja de ser `pending`, el adaptador devuelve payload, desaparece el estado. No se toca esa transición.

**Micro-interacción:** una sola línea — punto lavanda 6px (token `--accent-ai`, ~70% opacidad, late con el keyframe `copilot-typing` existente, un solo dot) + texto `text-tertiary` 13px. Al cambiar la frase: cross-fade ~180–220ms (`--ease-smooth`), translate-y ≤2px, nunca typewriter/shimmer. Vive donde hoy va el `TypingIndicator`; `role="status"` + `aria-live="polite"`.

**Mapa tool → etiqueta (es-CO):**

| Tool | Etiqueta |
|---|---|
| `getBalance`, `getAccounts` | Revisando tus cuentas… |
| `listRecentTransactions`, `searchTransactions`, `queryTransactions` | Revisando tus movimientos… |
| `getBudgetStatus` | Mirando tus presupuestos… |
| `getDebts` | Revisando tus deudas… |
| `listRecurring` | Revisando tus recurrentes… |
| `getSavings`, `listGoals` | Mirando tu ahorro y tus metas… |
| `getTopMerchants` | Viendo dónde gastas… |
| `getCashFlow` | Analizando tu flujo… |
| `listActiveInsights`, `getAdvice` | Buscando patrones… |
| `proposeCreateTransaction`, `proposeCardPurchase` | Preparando el movimiento… |
| `proposeSetBudget` | Preparando el presupuesto… |
| fallback (tool desconocido) | Trabajando… |
| sin tool activo, sin texto | Pensando… |
| tools resueltos, sin texto | Preparando tu respuesta… |

No forzar "Calculando…" (no hay tool de cálculo explícito; las cifras pasan por `queryTransactions`/`getCashFlow`). El mapa es la única fuente de verdad.

### Cambios a nivel de archivo
1. **`src/lib/copilot/render/copilot-phase.ts`** (nuevo, ~70 líneas, puro/testeable): `TOOL_LABELS` (keys = nombres exactos de `buildCopilotTools`) + `derivePhase(parts): string` aplicando la jerarquía. Lee `part.state` recorriendo de atrás hacia delante.
2. **`src/lib/copilot/adapters/llm-to-ast.ts`**: extraer el narrowing `isTool`/`toolNameOf(part)` a una util compartida y reusarla aquí y en `derivePhase` (sin cambio funcional).
3. **`src/components/copilot/typing-indicator.tsx`** (reescribir, o renombrar a `copilot-status.tsx`): prop `label?: string` (default "Pensando…"); dot lavanda + `<span>` con cross-fade por `key={label}` (`animate-in fade-in`, `tailwindcss-animate` ya en uso); `role="status"` + `aria-live="polite"`.
4. **`src/components/copilot/turn.ts`**: extender pending → `{ ...; pending: true; phase?: string }`.
5. **`src/components/app/copilot-dialog.tsx`** (`useMemo` de `turns`): calcular `phase = derivePhase(m.parts)` solo para el turno pending del último mensaje en streaming; pending sintético → "Pensando…".
6. **`src/components/copilot/chat-message.tsx`**: en la rama pending, `<TypingIndicator label={turn.phase} />`.
7. **`src/app/globals.css`** (bloque ~318–339): mantener keyframe `copilot-typing` (un dot); el bloque global `prefers-reduced-motion` ya neutraliza animación → cross-fade se vuelve swap instantáneo sin código extra.

### Datos/deps
Ninguno. 100% cliente, derivado del stream. No toca `/api/ai/chat` ni tools ni snapshot.

### Riesgos
- **Verificar empíricamente** los literales de `part.state` en `@ai-sdk/react` v6 (un `console.log` de `messages` en streaming) antes de fijarlos. `LoosePart` laxo protege de cambios menores.
- Eliminar los 3 dots: el dot único + texto es más informativo e igual de discreto.
- Frases que parpadean si los tools van muy rápido: el cross-fade suaviza; empezar sin debounce.

### Criterios de aceptación
- [ ] Al consultar movimientos se ve "Revisando tus movimientos…"; antes de tools "Pensando…"; tools resueltos sin texto "Preparando tu respuesta…".
- [ ] Cambio de frase = cross-fade ≤220ms, sin salto, sin typewriter/shimmer.
- [ ] Al llegar texto, el estado desaparece sin parpadeo del payload.
- [ ] Acento lavanda mínimo (`--accent-ai`); cero emojis/spinner/gradiente.
- [ ] `prefers-reduced-motion`: dot estático, swap instantáneo.
- [ ] Lector de pantalla anuncia el cambio (`aria-live`).
- [ ] Mobile (dialog full-screen): una sola línea, sin desbordar.
- [ ] Heurístico sigue mostrando "Pensando…" sin regresión. `typecheck`/`lint` limpios.

---

## Fase U2 — Formato de respuestas (markdown limpio en el camino LLM)

### Objetivo
El LLM devuelve markdown (listas, pasos, párrafos, negrita) que hoy se aplana en un solo `<p>` (`llm-to-ast.ts` mete todo en un bloque `text`). Renderizarlo limpio y armónico **solo en el camino LLM** (el heurístico sigue con bloques estructurados del `answer-ast`).

### Decisión de dependencia: `react-markdown` + `remark-gfm` (NO streamdown)
- **Bundle:** `streamdown` arrastra `mermaid` (~cientos de KB), `rehype-raw` y `marked` — nada de eso se quiere. `react-markdown@10` + `remark-gfm@4` comparten el núcleo `unified` sin esos pesos.
- **Seguridad:** `react-markdown` no renderiza HTML crudo por defecto (no incluir `rehype-raw`).
- **Streaming:** el adaptador ya hace `.join('').trim()` y `react-markdown` re-parsea el string completo en cada render → un `**` a medio cerrar es a lo sumo 1–2 frames. No justifica +mermaid. Mitigación diferida opcional: pre-cerrar marcadores colgantes.

**Deps nuevas:** `react-markdown@^10`, `remark-gfm@^4`. Justificadas: no hay parser de markdown en el repo.

### Diseño — componente `MarkdownProse` (Noir), solo bloques de texto del LLM
Component map restringido, sin imágenes ni HTML crudo:
- **p:** `text-text-secondary text-[14px] leading-relaxed`; separación vertical vía `space-y` del contenedor (no `<br>`).
- **ul/li:** viñetas sobrias a mano (marcador `·`/punto 3px `text-tertiary`), no `list-disc` nativo.
- **ol/li:** números en **Geist Mono tabular** (`font-mono tabular-nums`), `text-tertiary`, columna fija ~1.5rem → un paso-a-paso de 5 queda como 5 ítems numerados alineados (regla 10).
- **strong:** `text-text font-medium`. **em:** `italic text-text-secondary` (Inter italic, NO Fraunces).
- **code inline:** chip discreto `rounded-[4px] bg-surface-elevated px-1 py-0.5 text-[12.5px] font-mono`. **pre:** caja sobria sin syntax highlight.
- **h1–h6:** degradados a eyebrow `text-text-tertiary text-[11px] uppercase tracking-[0.08em]` (no romper la escala del chat).
- **a:** `text-text underline underline-offset-2`, filtrar esquemas a http/https/mailto (anti `javascript:`). Sin color de acento.
- **table (GFM):** borde 1px, celdas compactas, números mono. **Vetar** `img`/`iframe`/HTML crudo.
- **`accent-ai` NO se usa aquí** — el contenido del mensaje es contenido, no presencia de IA.
- Contenedor `space-y-2.5 text-[14px] leading-relaxed`, alineado al `gap-3` de `AssistantMessage`.

### Cambios a nivel de archivo
1. **`src/lib/copilot/render/answer-ast.ts`**: añadir bloque `{ type: 'markdown'; body: string }` (mantener `text` plano para el heurístico).
2. **`src/lib/copilot/adapters/llm-to-ast.ts`**: emitir `{ type: 'markdown', body: text }` (en vez de `text`) para el texto unido del LLM. El heurístico no cambia.
3. **`src/components/copilot/markdown-prose.tsx`** (nuevo, <300 líneas): `ReactMarkdown` con `remarkPlugins={[remarkGfm]}`, `components={...}` (map Noir), `disallowedElements`/filtro de URL.
4. **`src/components/copilot/chat-message.tsx`**: en `BlockView`, `case 'markdown': return <MarkdownProse body={block.body} />`. `case 'text'` intacto.
5. **`src/lib/ai/copilot/system-prompt.ts`** (sección "Cómo responder"): reforzar uso de listas numeradas para pasos, viñetas para ítems, negrita con moderación, sin encabezados grandes ni tablas salvo imprescindible, sin emojis ni code salvo lo técnico.

### Datos
Solo se amplía el AST (un tipo de bloque). Sin DB/migración.

### Criterios de aceptación
- [ ] Un paso a paso de 5 se ve como **5 ítems separados** con número mono alineado, no un párrafo corrido.
- [ ] Viñetas sobrias (no `list-disc`). `**negrita**` → `text-text font-medium`; `*cursiva*` Inter italic.
- [ ] Párrafos separados con `space-y`. `code` inline como chip discreto.
- [ ] Cero emojis/gradiente/glow, cero `accent-ai` en el contenido. `img`/HTML crudo/`javascript:` no se renderizan.
- [ ] Heurístico (`data-answer`) sin regresión (`case 'text'` igual).
- [ ] `typecheck`/`lint`/`build` ok; `markdown-prose.tsx` <300 líneas; `prefers-reduced-motion` ok.

---

## Fase U3 — Layout mobile: copiloto protagonista, sin "Más"

### Objetivo
Eliminar la pantalla "Más" (esconde Mi historia + config, degrada accesibilidad), hacer del copiloto el centro del shell móvil (FAB central), reubicar "Registrar movimiento" en el cluster superior, y subir touch targets del topbar a ≥44px. Solo afecta `<md`; desktop intacto.

### Diseño
**Bottom-nav (5 ranuras, sin "Más"):** `Hoy · Mi dinero · [◆ Copiloto FAB] · Mi plan · Mi historia` (4 secciones posesivas como Links + FAB central).
- **FAB central = Copiloto.** Único elemento con color: relleno **lavanda `--accent-ai`** (uso canónico: lavanda = presencia de IA), icono `sparkles`, 56px encajado (no flota, sin sombra/glow — eso violaría el mandato), `active:scale-95`. Abre el dialog `copilot`, nunca lleva indicador de ruta activa.
- Pasa de `--purple-base` (marca) a `--accent-ai` (IA): separa semánticamente marca vs IA. La barrita activa de sección sigue siendo morado marca `--brand-purple-strong` (forma/tamaño distintos al disco lavanda → sin confusión).
- 4 labels a `text-[10px]` caben a 360px; si roza, abreviar "Mi historia"→"Historia" (mantener `aria-label`).

**Topbar mobile — cluster (touch targets ≥44px, `h-11 w-11`):** `[Brand] Título … [Buscar] [Registrar +] [Notis] [Avatar]`.
- **Registrar** se mueve aquí (icon-only `plus`, `--purple-base` — acción primaria de marca, no IA). Único botón tintado del cluster.
- Buscar + `AlertsBell`: icon-only, border + `bg-surface`, a 44px.
- El botón "Preguntar"/copiloto **desaparece del topbar mobile** (ahora es el FAB).
- **Avatar/cuenta** como 4º elemento → puerta a config.

**Config (Ajustes/Categorías/Integraciones IA/cuenta):** el "Más" se elimina pero su contenido se reubica:
- **Mi historia** sube a ranura propia del bottom-nav (gana accesibilidad de primer nivel).
- **Alertas** ya tiene su campana (`AlertsBell` → `/ajustes#alertas`).
- **Importar CSV** vive contextual en `/mi-dinero/movimientos?import=open` (CTA dentro de esa vista).
- **Ajustes / Categorías / Integraciones IA + cuenta:** menú bajo el avatar usando **`Sheet` (side="bottom")** ya existente en `src/components/ui/sheet.tsx` (no añadir `dropdown-menu`: el bottom-sheet cubre el caso con menos superficie y mejor ergonomía táctil/safe-area). Un `mobile-account-sheet.tsx` con esos links + `UserButton` de Clerk al pie (patrón ya usado en el "Más").

### Cambios a nivel de archivo
- **`src/components/app/mobile-nav.tsx`**: quitar `moreOpen`/`MobileMoreSheet`/item "Más"; añadir `/mi-historia` (icon `book-open`) a `RIGHT_ITEMS`; FAB → `openDialog('copilot')`, `aria-haspopup="dialog"`, icono `sparkles`, fondo `--accent-ai`; mantener warmup prefetch (+`/mi-historia`).
- **`src/components/app/topbar.tsx`**: cluster `<md` con Buscar + Registrar (`--purple-base`) + `AlertsBell` + avatar, todos `h-11 w-11`; ocultar "Preguntar" en mobile (`hidden md:inline-flex`); desktop intacto.
- **`src/components/app/alerts-bell.tsx`**: 44px en mobile (`h-11 w-11` <md, `h-9` desktop); badge lavanda.
- **`src/components/app/mobile-account-sheet.tsx`** (nuevo, reemplaza conceptualmente al more-sheet): `Sheet side="bottom"` con links Ajustes/Categorías/Integraciones IA + `UserButton`; items `min-h-[44px]`.
- **Eliminar `src/components/app/mobile-more-sheet.tsx`**.
- **`src/app/globals.css`**: opción recomendada `--topbar-h-mobile: 60px` con `min-h-[var(--topbar-h-mobile)] md:min-h-[var(--topbar-h)]`; validar que ningún `sticky top-[var(--topbar-total)]` (day-headers/section-tabs) se rompa.
- **`src/app/(app)/layout.tsx`**: sin cambios estructurales; verificar el `pb` del `<main>`.

### Datos/deps
Ninguno. `dialog-store.ts` ya expone `copilot` y `new-transaction`. Reusa `Sheet`, `radix-ui`, Clerk `UserButton`.

### Riesgos
- 4 labels + FAB a 360/320px: validar; fallback "Historia".
- Lavanda FAB vs morado indicador: distinta forma/jerarquía, alineado al mandato.
- Config bajo avatar: intencional (config ≠ navegación de contenido); también alcanzable desde `/ajustes` (hash anchors).
- Topbar +4px: trivial vs ganancia de tappabilidad.

### Criterios de aceptación
- [ ] No existe `mobile-more-sheet.tsx` ni item "Más"; bottom-nav = Hoy/Mi dinero/[FAB Copiloto]/Mi plan/Mi historia.
- [ ] FAB abre `copilot`, lavanda `--accent-ai`, sin sombra/glow, con `aria-label`/`aria-haspopup`.
- [ ] "Registrar" en el topbar abre `new-transaction`; todos los botones del cluster ≥44×44.
- [ ] Ajustes/Categorías/Integraciones IA alcanzables desde el sheet del avatar; sesión vía `UserButton`. Mi historia a un toque.
- [ ] Indicador activo en las 4 secciones; el FAB nunca lo muestra. Safe-area arriba/abajo en PWA iOS.
- [ ] Foco/`aria-current`/teclado ok; `prefers-reduced-motion` (sin scale). Desktop sin regresiones.
- [ ] Cero emojis/saturado; `lint`/`typecheck` limpios.

---

## Fase U4 — Onboarding de alto impacto (perfil profundo → personalización)

### Objetivo
Convertir el wizard de 3 pasos en un onboarding fluido (~2–3 min) que capture un perfil de personalización honesto e inyecte al `profile-snapshot`, de modo que el copiloto cambie tono, profundidad y prioridad según quién pregunta. Sin pseudociencia, sin fine-tuning: personalización por prompt, editable luego. **Regla rectora: cada señal capturada produce al menos una línea de snapshot o un ajuste de tono medible.**

### Señales a capturar (priorizadas por impacto)
Se mantienen los 3 pasos actuales + 4 nuevos:
1. **Conocimiento financiero** (`literacy`: `basico|intermedio|avanzado`) — decide si define términos o asume conocimiento. *Máximo impacto.*
2. **Tono/estilo** (`commStyle`: `directo|detallado|didactico`) — prosa vs bullets, si justifica el "por qué". Mapea a `textVerbosity`.
3. **Mini-test de personalidad financiera** (3 preguntas de **comportamiento**, no psicología) → deriva `moneyStyle` (`planificador|equilibrado|espontaneo`) + `horizon` (`corto|medio|largo`) + `riskTolerance`:
   - P1 reacción a imprevisto; P2 horizonte temporal; P3 control vs flexibilidad.
   - Enmarcado honesto: *"No es un test de personalidad. Solo nos ayuda a hablarte como te sirve."* Derivación determinista y auditable (`derivePersona`).
4. **Foco actual** (`focus`: multi-select máx 2 de `salir_de_deudas|crear_colchon|ahorrar_meta|invertir|ordenar_gastos|entender_a_donde_va`) — qué priorizar en diagnósticos.

**No se pide:** ingreso exacto (ya hay rango), portafolio, edad/estado civil, ni nada que suene a evaluación crediticia.

### Flujo
6–7 pasos cortos, una decisión por pantalla (mobile-first, chips ≥44px, una columna <sm). Barra de progreso recalculada. Skippable global (7 días `localStorage`) **y por paso** (omitir un campo no bloquea terminar; el mínimo viable son los 3 originales). Transición fade/slide sutil (Motion `cubic-bezier(0.32,0.72,0,1)` 220ms, `prefers-reduced-motion`). El mini-test como 3 sub-pantallas con mini-progreso. Cierre Fraunces italic sin ilustración.

### Modelo de datos (en `profiles.aiProfile`, SIN migración)
```
aiProfile: {
  incomeRange?, mainGoal?, riskTolerance?   // legacy top-level, se mantienen
  copilot?: { routing, provider, model, ... }  // existente, no se toca
  persona?: {
    literacy?: 'basico'|'intermedio'|'avanzado'
    commStyle?: 'directo'|'detallado'|'didactico'
    moneyStyle?: 'planificador'|'equilibrado'|'espontaneo'   // derivado
    horizon?: 'corto'|'medio'|'largo'                        // derivado
    focus?: Array<...>  // máx 2
    testAnswers?: { p1, p2, p3 }   // para re-derivar/editar
    updatedAt?: string
  }
}
```
`riskTolerance` se sigue escribiendo top-level (lo lee el snapshot). `persona` ausente → snapshot lo omite (cero ruptura). Zod: todo `.optional()`, enums estrictos, `focus.array().max(2)`; el server rechaza fuera de enum.

### Traducción señal → snapshot/tono (el corazón honesto)
| Señal | Línea de snapshot | Efecto en prompt |
|---|---|---|
| `literacy: basico` | "Conocimiento financiero: básico (define términos)." | `explainTerms=true` |
| `literacy: avanzado` | "…avanzado (usa términos sin definir)." | omite definiciones |
| `commStyle: directo` | "Estilo preferido: directo, al grano." | `verbosity=low` |
| `commStyle: didactico` | "…didáctico, agradece el porqué." | `verbosity=high` + explicar |
| `moneyStyle: espontaneo` | "Relación con el dinero: espontáneo; guías flexibles." | evita tono de regaño |
| `moneyStyle: planificador` | "…planificador; reglas y metas claras." | puede proponer estructura |
| `horizon: largo` | "Horizonte: años; valora proyecciones." | prioriza metas/proyección |
| `focus: [...]` | "Foco actual: …" | `focusOrder` en diagnósticos |

La persona no introduce números → cero riesgo de alucinación de cifras (el prompt ya advierte que el snapshot es aproximado).

### Cambios a nivel de archivo
1. **`src/lib/ai/copilot/persona.ts`** (nuevo): constantes de opciones + las 3 preguntas; `personaSnapshotSchema` (Zod); `derivePersona(answers)` (puro, determinista); `personaToSnapshotLines(persona)`; `personaToToneHints(persona)` → `{ verbosity, explainTerms, focusOrder }`.
2. **`src/components/app/onboarding-overlay.tsx`** (refactor a orquestador con `useReducer`) + carpeta **`src/components/app/onboarding/`** con un componente por paso (`step-*.tsx`) + `chip.tsx` (extraer el Chip hoy duplicado). Cada archivo <300 líneas.
3. **`src/app/(app)/ajustes/perfil-financiero/actions.ts`**: extender `onboardingSchema` con `persona` (Zod); `completeOnboarding` con merge **`.for('update')`** (arregla el lost-update latente del onboarding actual); extender `personaSchema` de `updateFinancialPersona` con los campos editables.
4. **`src/lib/ai/copilot/profile-snapshot.ts`**: leer `aiProfile.persona`, insertar `...personaToSnapshotLines(persona)`.
5. **`src/lib/ai/copilot/system-prompt.ts`**: aceptar `toneHints` opcional; inyectar 1–3 líneas condicionales en "Cómo responder" (define términos / sé breve / prioriza foco). Sin persona ⇒ cero tokens extra.
6. **`src/lib/ai/copilot/index.ts`**: leer `aiProfile.persona` (ya hace la lectura del perfil), derivar `toneHints`, pasarlos a `buildSystemPrompt`.
7. **`src/components/app/settings/perfil-section.tsx`** + **`perfil-financiero-client.tsx`**: tarjeta "Cómo te habla el copiloto" con los chips (literacy/commStyle/focus) + `moneyStyle`/`horizon` editables (chips, sin repetir el test).

### Deps
Ninguna (Motion, Zod, `useReducer` ya disponibles).

### Riesgos
- Abandono por más pasos → skip global + por paso, una decisión por pantalla, chips, mini-progreso.
- "Horóscopo financiero" → copy honesto + `derivePersona` determinista + override en Ajustes.
- +80–120 tokens en el prompt (condicionados): aceptable.
- Lost-update jsonb del onboarding → se arregla con `.for('update')`.
- Sobre-personalización → hints sutiles, no cambian la identidad base ni el mandato.

### Criterios de aceptación
- [ ] Wizard con 3 pasos originales + literacy + commStyle + mini-test (3 sub) + focus + cierre; navegable atrás/adelante; cada paso de personalización saltable sin bloquear el final.
- [ ] `completeOnboarding` persiste `aiProfile.persona` validado por Zod, con lock de fila.
- [ ] Usuario sin `persona` no rompe nada (campos omitidos).
- [ ] Snapshot emite una línea por señal presente; prompt inyecta hints condicionadas (sin persona ⇒ cero líneas).
- [ ] Editar literacy/commStyle/focus/moneyStyle desde `/ajustes` se refleja en la siguiente respuesta.
- [ ] Mini-test deriva determinísticamente; `riskTolerance` legible por el snapshot legacy.
- [ ] Mandato Noir (chips focus `accent-ai/40`, monto Geist Mono, cierre Fraunces, transiciones smooth, reduced-motion). Componentes <300 líneas, sin `any`/barrel; `typecheck`/`lint` limpios.
- [ ] Cambio observable: `literacy=basico` define un término que `avanzado` no; `commStyle=directo` responde más corto (smoke test).

---

## Validación y cierre (cross-cutting)

- Tras cada fase: `pnpm typecheck` (exit real), luego `pnpm lint && pnpm test && SKIP_ENV_VALIDATION=1 pnpm build`.
- Un commit por fase (o sub-fase), mensaje en español con el porqué, cerrando con el trailer `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- **Revisión adversarial** (Workflow) del diff de cada fase antes de cerrar (como en el Step 19): dimensiones por área + verificación escéptica; corregir hallazgos confirmados.
- Verificación visual manual en mobile (320–430px) para U1/U2/U3 — el agente no puede renderizar la ruta autenticada headless; dejar checklist de QA al usuario.
- No push, no tocar git remote/config salvo que el usuario lo pida.
- Actualizar `docs/PROGRESS.md` (y este archivo si algo cambia) al cerrar.

---

## Prompt para continuar en otra sesión

> Copia este prompt en una sesión nueva (idealmente con `/effort ultracode`). Es autocontenido.

```
Continúa el trabajo en Finanzia (cwd: /Users/daniel/Documents/GitHub/finanzia-app, rama main, modo autónomo salvo decisiones de producto). Eres Claude Code sobre una webapp de finanzas personales con IA (Next.js 16 App Router, TS strict, Tailwind v4, shadcn/ui, radix-ui, AI SDK v6, Drizzle+Supabase, Clerk). Mandato estético Noir innegociable: cero emojis, cero gradientes/glow/shimmer, números Geist Mono tabular, lavanda accent-ai SOLO para presencia de IA, morados de marca solo en detalles, "más caro que amigable", mobile compacto/minimalista.

ANTES DE TOCAR NADA, lee y entiende a fondo:
1. CLAUDE.md (reglas no negociables y mandato estético).
2. docs/PROGRESS.md (estado del proyecto; el Step 19 resume la integración del LLM como cerebro del copiloto).
3. docs/copilot-llm.md (cómo funciona el copiloto/LLM: config por env, routing local/llm, selector de motor, tools, snapshot).
4. docs/ux-sprint-plan.md (ESTE PLAN: las fases U1–U4 detalladas, con cambios a nivel de archivo y criterios de aceptación).
5. docs/finanzia-blueprint.md (fuente de verdad del producto si hay contradicción).
Luego recorre el código real de las áreas afectadas para confirmar que el plan calza con el estado actual (los archivos pueden haber cambiado): el copiloto (src/components/app/copilot-dialog.tsx, src/components/copilot/*), el motor LLM (src/lib/ai/copilot/*), el adaptador (src/lib/copilot/adapters/llm-to-ast.ts) y el render (src/lib/copilot/render/answer-ast.ts), el shell mobile (src/components/app/{mobile-nav,topbar,alerts-bell,mobile-more-sheet}.tsx, src/app/(app)/layout.tsx, src/app/globals.css), y el onboarding (src/components/app/onboarding-overlay.tsx, src/app/(app)/ajustes/perfil-financiero/*, src/lib/ai/copilot/{profile-snapshot,system-prompt}.ts).

OBJETIVO: ejecutar el sprint UX de docs/ux-sprint-plan.md, priorizando experiencia de usuario limpia/fluida/armónica. Orden recomendado: U1 (feedback de generación humano) → U2 (formato markdown de respuestas) → U3 (layout mobile: copiloto FAB central, sin pantalla "Más", touch targets ≥44px) → U4 (onboarding profundo + personalización por prompt). U1/U2/U3 son quick-wins; U4 es el más grande.

REGLAS DE EJECUCIÓN: crea tareas (TaskCreate) por fase; un commit por fase (o sub-fase), mensaje en español con el porqué, cerrando con
Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
Validación: pnpm typecheck (exit real, sin pipe a tail) tras cada commit; pnpm typecheck && pnpm lint && pnpm test && SKIP_ENV_VALIDATION=1 pnpm build al cerrar cada fase. Nunca silenciar con any/eslint-disable/ts-expect-error ni --no-verify. Componentes ≤300 líneas, imports @/, sin barrel exports, dinero nunca float, RLS respetada (tools filtran por userId), toda mutación con confirmación UI. Sin migraciones SQL (los datos nuevos van en profiles.aiProfile jsonb, validados con Zod). NO push, NO tocar git remote/config. Tras cada fase, corre una revisión adversarial (Workflow) del diff y corrige los hallazgos confirmados. Como no puedes renderizar la ruta autenticada (Clerk) headless, deja un checklist de QA visual mobile (320–430px) para el usuario. Actualiza docs/PROGRESS.md al cerrar.

Detalle clave de U2: usar react-markdown + remark-gfm (NO streamdown — arrastra mermaid). Render Noir restringido (sin HTML crudo, sin img, listas ordenadas con números Geist Mono tabular), solo para el camino LLM; el heurístico sigue con bloques del answer-ast.
Detalle clave de U1: verifica empíricamente la forma de message.parts y part.state en @ai-sdk/react v6 (un console.log en streaming) antes de fijar literales.
Detalle clave de U3: el FAB central del bottom-nav pasa a ser el COPILOTO (lavanda accent-ai), "Registrar movimiento" sube al cluster del topbar; la config (Ajustes/Categorías/Integraciones IA + cuenta) se reubica en un Sheet bottom bajo el avatar (reusar src/components/ui/sheet.tsx, NO añadir dropdown-menu).
Detalle clave de U4: personalización honesta por prompt (snapshot + hints de tono), nada de fine-tuning real; mini-test de comportamiento determinista (derivePersona), todo en aiProfile.persona, editable en /ajustes.

Empieza confirmando que leíste los archivos de contexto y resumiendo en 3–5 líneas el estado actual y tu plan para U1, luego ejecuta.
```
