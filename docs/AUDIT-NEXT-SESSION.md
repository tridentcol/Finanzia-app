# Arranque de sesión — Ejecutar el plan de la auditoría

> Documento de handoff para empezar en una **sesión nueva** sin re-escanear el código.
> Toda la evidencia detallada (92 hallazgos con `file:line`, severidad, esfuerzo y
> recomendación) ya vive en **`docs/AUDIT-findings.md`**. Este archivo es el resumen
> operativo + el prompt de arranque + las decisiones pendientes.

---

## Qué se hizo

El 2026-05-30 se corrió un **workflow multi-agente read-only** (8 agentes por dimensión +
verificación adversarial + síntesis priorizada). Resultado: **92 hallazgos verificados**,
priorizados por `impacto × severidad ÷ esfuerzo`, en `docs/AUDIT-findings.md`. Ningún
archivo de la app fue modificado. Esta sesión nueva es para **ejecutar** (ya no auditar).

## Estado del proyecto (contexto mínimo)

Finanzia: webapp de finanzas personales con IA. Next.js 16 (App Router), TS strict
(`noUncheckedIndexedAccess`, sin `any`), Tailwind v4, shadcn/ui, Supabase Postgres +
Drizzle, Clerk, Vercel AI SDK, Visx, Motion, Vercel. Mandato de diseño **Noir** (`CLAUDE.md`
es ley). Single-user MVP, multi-tenant ready. COP/USD multi-divisa.

Fuentes de verdad (leer solo lo que toque la fase en curso):
`docs/finanzia-blueprint.md` · `CLAUDE.md` · `docs/AUDIT-findings.md` (este plan) ·
`docs/PROGRESS.md` · `docs/ROADMAP-IA-V2.md` · `docs/copilot-llm.md` ·
`docs/llm-openai-integration-plan.md`.

## Los 3 riesgos de cabecera (lo que más duele)

1. **Integridad del dinero (viola regla no negociable #4).** La conversión multi-divisa que
   persiste `amount_base` usa float (`parseFloat * rate`). Caminos afectados: webhook
   email-inbox (usa moneda de la cuenta, no del perfil), `updateTransaction` (corrompe
   `amount_base` cuando falta tasa), recurrentes (1:1 silencioso). Evidencia:
   `src/lib/currency/rates.ts:230-235`, `src/app/api/webhooks/email-inbox/route.ts:98-126`,
   `src/app/(app)/mi-dinero/movimientos/actions.ts:516-528`.
2. **Red de seguridad ausente.** Cero `error.tsx`/`not-found.tsx` (viola regla 8), Sentry sin
   cablear pese a `SENTRY_DSN`, y `/api/ai/chat` sin rate limit pese a tener Upstash. Fallos
   y abuso pasan invisibles.
3. **RLS no protege en runtime.** La app conecta con rol de servicio que salta RLS; el
   aislamiento depende solo de `where(eq(userId,...))`. Además 5 tablas nuevas sin policy
   (`drizzle/rls.sql`).

## Plan a seguir (fases — la fuente completa es `docs/AUDIT-findings.md`)

Orden recomendado: **Fase 0 → 1 → 2** primero (riesgo + quick-wins), luego 3/4/5 según prioridad.

### Fase 0 — Quick-wins (esfuerzo S)
Rate limit en `/api/ai/chat` (Upstash slidingWindow por `userId`, 429 `{ok,error}`) ·
`getProfile()` con React `cache()` + paralelizar waterfalls del dashboard · `loading.tsx`
faltantes (~9 rutas, priorizar dinámicas `[id]`/`[period]`) · `process.env` directo →
`src/lib/env.ts` (añadir `AI_GATEWAY_API_KEY`, `FINANZIA_COPILOT_DEBUG`) + lint guards
(`max-lines`, `no-explicit-any`, `no-restricted-syntax` para process.env) · RLS en las 5
tablas nuevas + re-correr `db:bootstrap` · aislar fallo por iteración en crons
insights/exchange-rates · `aria-label` en Cmd+K + `focus-visible` en controles custom ·
sanear `err.message` en crons · eliminar `recharts` (no se usa).

### Fase 1 — Integridad del dinero (regla #4)
Reescribir `convert()` a aritmética entera/dinero.js (centavos, redondeo half-even) **con
tests de precisión** · corregir webhook email-inbox (base del perfil, sin parseFloat) ·
corregir fallback de `amount_base` en `updateTransaction` y propagar el flag `missing` de
`convertAmount` · float en `analyzePurchase`. Esta fase **crea la cobertura de tests
financieros hoy inexistente** (los 6 tests actuales son solo del copiloto).

### Fase 2 — Red de seguridad y observabilidad
`error.tsx`/`not-found.tsx` Noir (copy Fraunces, reset text-sobre-bg) + Sentry con
`instrumentation.ts` + `onRequestError` · reconstruir el journal de migraciones (drift:
9 `.sql`, journal lista 4 → `db:migrate` omite 5) y documentar migrate vs push en DEPLOY.md ·
idempotencia de imports/email (`transactions.externalId` + uniqueIndex parcial +
`onConflictDoNothing`) · atomicidad de recurrentes (`db.transaction()`).

### Fase 3 — Accesibilidad y rendimiento
Contraste `--text-tertiary` ≥4.5:1 (dark+light) · live region del copiloto (`aria-live`) ·
teclado del `CategoryCombobox` (flechas/Enter, role=combobox) · tap targets ≥44px mobile ·
Cache Components/PPR (shell + datos en `<Suspense>`) · code-splitting de charts @visx con
`next/dynamic` + `optimizePackageImports`.

### Fase 4 — Producto y paridad de flujos
Gestión completa de deudas (acciones/edición o ruta `deudas/[id]` — hoy es callejón sin
salida) · equivalente multi-divisa en listados (subtexto en base) · detalle de filas
omitidas en imports · acceso de primer nivel al copiloto en desktop · onboarding encadenado
al primer dato.

### Fase 5 — Personalización de IA (programa por sub-fases)
**Postura: construir sobre lo existente, NO fine-tuning por usuario (PII financiera).**
0.5 evals + golden sets + dashboard `userCorrected` → 1 memoria de preferencias (`aiProfile`
jsonb) + few-shot dinámico desde `userCorrected` en el `llmFallback` de categorización →
Infra AI Gateway como ruta **default** (no solo fallback) → 2 RAG semántico en el copiloto
(los embeddings 1536d ya existen; `searchTransactions` hoy es ILIKE, no vectorial). La
regla 6 (LLM no muta sin confirmación UI) permanece inviolable en toda fase. Ver la matriz
esfuerzo×impacto×riesgo completa en la sección "Personalización de IA por usuario" del
informe.

### Higiene continua (transversal)
Reglas de lint que protejan el mandato · extraer archivos > 450 líneas (21 superan 300) ·
**alinear CLAUDE.md/blueprint con el stack real**: dice "Claude Sonnet 4.6" pero el copiloto
default es OpenAI `gpt-5.4-mini` (`src/lib/ai/copilot/config.ts:37`); Claude solo en
fallbacks de categorización e insights · auditar el 100% de queries por filtro `userId`
mientras RLS no proteja en runtime.

## Reglas no negociables al ejecutar (de `CLAUDE.md`)

- **Mandato Noir es ley.** Cero emojis/gradientes/glow/saturación/shimmer. Números Geist
  Mono tabular. Acento lavanda solo IA; morados de marca solo identidad.
- **Dinero nunca float** (numeric(15,2) + dinero.js). Toda transacción guarda
  `amount_original + currency + amount_base + exchange_rate`.
- **LLM nunca muta sin confirmación UI (regla 6).** Tools `propose-*` solo retornan
  propuesta; `confirmProposed*` re-valida con Zod y ejecuta la action canónica.
- **RLS en toda tabla con `user_id`.** `service_role_key` jamás al cliente.
- Toda mutación valida con Zod · respuesta `{ok,data}|{ok,error:{code,message}}` ·
  estados loading/error/empty por página · ≤300 líneas/componente · `env` vía `src/lib/env.ts`.
- **El push lo hace el usuario.** Claude commitea por cambio. Trailer:
  `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.

## Comandos

`pnpm dev` · `pnpm build` · `pnpm lint` · `pnpm typecheck` · `pnpm test` ·
`pnpm db:generate` · `pnpm db:push` · `pnpm db:migrate` · `pnpm db:bootstrap` · `pnpm db:seed`

---

## Prompt para pegar en la sesión nueva

> Copiá el bloque de abajo tal cual al iniciar la sesión fresca.

```
Voy a ejecutar el plan de la auditoría de Finanzia. Contexto y plan completos están en
docs/AUDIT-NEXT-SESSION.md (resumen + fases) y docs/AUDIT-findings.md (los 92 hallazgos con
file:line, severidad y esfuerzo). CLAUDE.md es ley (mandato Noir + reglas no negociables).

Antes de tocar nada: leé docs/AUDIT-NEXT-SESSION.md completo y la sección de la fase que
vamos a atacar en docs/AUDIT-findings.md. NO re-audites; ya está hecho.

Empecemos por la FASE 0 (quick-wins, esfuerzo S). Para cada ítem: (1) abrí el archivo en la
evidencia, (2) confirmá que el hallazgo sigue vigente, (3) aplicá el fix respetando Noir y
las reglas no negociables, (4) corré pnpm lint + pnpm typecheck (y pnpm test si toca lógica),
(5) commiteá ese cambio solo, con el trailer Co-Authored-By de Claude Opus 4.8. No hagas
push (lo hago yo). Si un fix es más grande de lo esperado o choca con el mandato, parás y me
preguntás antes de seguir.

Arrancá listando los ítems de la Fase 0 como tareas y proponé el orden; luego ejecutá el
primero.
```

Cambiá "FASE 0" por la fase que quieras atacar. Para la Fase 1 (dinero) advertí al agente que
**escriba los tests primero** (round-trip de conversión y precisión) antes de reescribir
`convert()`.
