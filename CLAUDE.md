# Finanzia

Webapp de finanzas personales con IA — multi-tenant ready, single-user MVP. Núcleo en español, COP/USD multi-divisa.

## Commands

- `pnpm dev` — Dev server
- `pnpm build` — Production build
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm db:generate` — Generar migración Drizzle
- `pnpm db:push` — Aplicar schema (dev). Requiere DATABASE_URL/DIRECT_URL.
- `pnpm db:migrate` — Aplicar migraciones (prod)
- `pnpm db:studio` — Drizzle Studio
- `pnpm db:bootstrap` — Crea extensión `vector` y aplica RLS (correr después de `db:push`)
- `pnpm db:seed` — Seed de categorías sistema

## Tech Stack

Next.js 16 (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui + Supabase Postgres + Drizzle + Clerk + Vercel AI SDK + Visx + Motion + Vercel.

**Stack de IA (real, dual):** OpenAI es el default — embeddings `text-embedding-3-small` (categorización kNN, retrieval, intents) y copiloto chat (`gpt-5.4-mini`, ver `src/lib/ai/copilot/config.ts`). Claude (Sonnet 4.6) solo en el fallback LLM de categorización y en recomendaciones de insights. La resolución de key prefiere la del usuario (Vault) → Vercel AI Gateway (`AI_GATEWAY_API_KEY`, recomendado en operador para observabilidad de costo/latencia) → key directa del operador.

## Architecture

### Directory Structure

- `src/app/(app)/` — App autenticada (protegida por middleware Clerk)
- `src/app/(marketing)/` — Reservada para landing pública futura
- `src/app/api/` — Webhooks, AI routes, crons
- `src/components/ui/` — shadcn primitivos customizados al sistema Noir
- `src/components/app/` — Componentes de dominio (rail, command, insight-card, amount, chart)
- `src/components/copilot/` — Copiloto Finanzia (Cmd+K → IA)
- `src/components/brand/` — Sistema de marca: `BrandMark` (símbolo SVG Horizonte) y `BrandWordmark` (Sora 500). Único lugar autorizado para Sora.
- `src/lib/db/` — Drizzle schema + queries
- `src/lib/ai/` — Vercel AI SDK client, prompts, tools, pipelines
- `src/lib/currency/` — Formato, conversión, tasas
- `src/lib/motion/` — Easings, durations, variants globales
- `src/lib/design/` — Tokens, lista curada de iconos

### Data Flow

- RSC fetch directo via Drizzle para todas las vistas
- Mutaciones via Server Actions con `revalidatePath`
- Streams (copiloto) via `/api/ai/chat` con AI SDK `streamText`
- Cliente solo usa TanStack Query para datos vivos (estado de imports, mensajes streaming)

### Key Patterns

- **Server Components by default**. `"use client"` solo cuando interactividad/animación lo requiere
- **Toda mutación valida con Zod** (Server Action o API route)
- **Toda response sigue** `{ ok: true, data } | { ok: false, error: { code, message } }`
- **Dinero NUNCA es `number`**. Usar `Dinero({ amount: cents, currency })` o `numeric` en Drizzle
- **Multi-divisa**: cada transacción persiste `amount_original + currency + amount_base + exchange_rate`. UI muestra base por default
- **IA**: si LLM propone mutación, requiere confirmación UI antes de ejecutar Server Action real
- **Embeddings**: cada transacción tiene vector(1536). Auto-categorización usa pgvector kNN + few-shot
- **View Transitions API** habilitada — todas las navegaciones entre `(app)/*` son spatial

## Code Organization Rules

1. **Una responsabilidad por archivo.** Máx 300 líneas por componente. Si crece, extraer.
2. **Path alias `@/`** apunta a `src/`. Nunca relativos largos.
3. **Sin barrel exports.** Import directo del source.
4. **Server Components by default.** `"use client"` solo si hay state, effect, listener, motion, o uso de Context que requiera cliente.
5. **Co-locate** componentes específicos de una página al lado de su `page.tsx`.
6. **Toda env var** se accede vía `env` desde `src/lib/env.ts` — nunca `process.env` directo.
7. **Toda query DB** pasa por `src/lib/db/queries/` o se escribe inline en RSC — nunca en client component.
8. **Estados de loading, error y empty obligatorios** para cada página.

## Design System — Finanzia Noir

### Mandato Estético

**Anti-dashboard genérico. Anti-AI-template colorido.** Premium fintech, editorial, minimalista. Referencias: Linear, Mercury, Arc, Raycast, Stripe Dashboard. Cero emojis. Cero gradientes. Cero glow. Cero ilustraciones 3D. Tipografía como protagonista — los números son los héroes. Color restrained, casi monocromático. Dos acentos disciplinados: `#B8A6F5` lavanda **solo para presencia de IA** (sparkles, copilot, focus rings), y la **familia morada del brand** Horizonte (`--brand-purple-{strong,deep,soft}`) **solo para identidad de marca y estados sutiles** (logo, hover/active sidebar tintados con color-mix al 6-18%, indicador bottom-nav, watermark landing). Nunca botones primarios — esos siguen siendo `--text` sobre `--bg` estilo Linear/Mercury.

### Colors (dark — default)

- `bg` #0A0A0B · `surface` #141416 · `surface-elevated` #1C1C1F · `surface-hover` #222226
- `border` #26262A · `border-emphasis` #34343A
- `text` #FAFAFA · `text-secondary` #A1A1A8 · `text-tertiary` #6B6B72
- `accent-ai` #B8A6F5 (acento IA — sparkles, copilot, focus)
- `brand-purple-strong` #7C3AED · `brand-purple-deep` #4C1D95 · `brand-purple-soft` #A78BFA (familia marca Horizonte — logo + hover/active sidebar + indicador bottom-nav)
- `positive` #7FB89F · `negative` #D4938A · `warning` #D4B58A
- Cero saturación alta. Cero color en botones primarios genéricos.

### Colors (light)

- `bg` #FAFAF9 · `surface` #FFFFFF · `border` #E7E5E4
- `text` #0A0A0B · `text-secondary` #52525B
- `accent-ai` #7C6FCD · `positive` #5A9279 · `negative` #B57167

### Typography

- Display: Inter Display 56–96px, weight 600–700, tracking -0.03 a -0.04em
- Headings: Inter 16–32px, weight 600
- Body: Inter 13–16px, weight 400
- **Números: Geist Mono** con `font-variant-numeric: tabular-nums` — siempre
- Editorial: Fraunces italic — SOLO en empty states y copy onboarding (parsimonia)
- **Wordmark de marca: Sora 500** lowercase tracking -0.05em line-height 1 — exclusivo del `BrandWordmark` component. **Nunca usar Sora fuera del lockup de marca.**

### Spacing & Radius

- Base 4px. Scale: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128
- Max content 1240px. Rail 56px. Topbar 56px. Cmd+K 640px ancho
- Radius: 4 (chips), 8 (inputs/botones), 12 (cards), 16 (modals), 999 (avatars). Nunca 0 en surfaces

### Motion

- Easing default: `cubic-bezier(0.32, 0.72, 0, 1)` (smooth)
- Durations: 120 (instant), 220 (fast), 320 (base), 480 (slow), 800 (ambient)
- Físicas: spring stiffness 320 damping 32
- Animaciones smooth, never bouncy. Cero overshoot visible. Respetar `prefers-reduced-motion`

### Component style

- Botones sin uppercase, sin shadow, border 1px, hover sutiliza bg
- Inputs 40px alto, focus ring `accent-ai/40`, no glow
- Cards: surface + border 1px + radius 12px. Nunca cards anidadas con borders dobles
- Empty states: tipografía Fraunces italic, sin ilustración
- Loading: skeleton opacity-based, no shimmer gradient. Spinner 2px stroke
- Iconos: lucide stroke 1.5px, color `currentColor`. Lista curada en `src/lib/design/icons.ts`

## Environment Variables

Validadas con Zod en `src/lib/env.ts`. Si falta una, la app no inicia.

- `DATABASE_URL`, `DIRECT_URL` (Supabase)
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET`
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
- `TRIGGER_API_KEY`, `TRIGGER_API_URL`
- `EXCHANGE_RATE_API_KEY`
- `SENTRY_DSN`
- `CRON_SECRET`

## Reglas No Negociables

1. **Cero emojis** en UI, copy, iconos, comentarios visibles, mensajes del copiloto. Punto.
2. **Cero colores saturados.** Toda decisión de color valida contra paleta Noir. Si dudas, monocromático gana.
3. **Cero gradientes, glow, glassmorphism exagerado, shimmer, parallax, particles, confetti, bouncy springs.**
4. **Dinero nunca como `number` flotante.** Drizzle `numeric(15,2)` + dinero.js en aplicación.
5. **Toda transacción guarda original + base currency.** Mostrar siempre el contexto multi-divisa cuando aplica.
5a. **Las tarjetas de crédito viven en `accounts.type='credit_card'`. Las demás deudas (préstamos, hipotecas, etc.) viven en la tabla `debts`.** La página `/deudas` unifica visualmente ambos modelos. No migrar tarjetas a `debts`.
6. **El LLM nunca muta datos sin confirmación UI.** Tool calls que mutan retornan propuesta; usuario confirma; entonces Server Action ejecuta.
7. **RLS habilitada en toda tabla con `user_id`.** Sin excepciones.
8. **Todo lo público del cliente puede leer datos solo via anon key + RLS** — la `service_role_key` jamás se expone al cliente.
9. **TypeScript strict, `noUncheckedIndexedAccess: true`, sin `any`.** Si un tipo es difícil, usa `unknown` + narrowing, no `any`.
10. **Tipografía: números siempre Geist Mono tabular.** Sin excepciones.
11. **View Transitions habilitadas para toda navegación `(app)/*`.**
12. **`prefers-reduced-motion: reduce` respetado en toda animación.**
13. **Mandato Estético es ley.** Cualquier sugerencia de skill externa (incluida `/ui-ux-pro-max`) que viole el mandato se rechaza.
14. **Empty states son una oportunidad editorial, no un bug a ocultar.** Tipografía Fraunces, body Inter, sin ilustración.
15. **Cuando dudes entre dos diseños, elige el que parezca más caro, no el que parezca más amigable.**
16. **Navegación del shell apunta a rutas REALES, nunca a redirects.** Los links de navegación expuestos en el layout principal (sidebar `app-sidebar`, bottom-nav `mobile-nav`, y cualquier nav futura del shell) deben apuntar al landing concreto de cada sección (`/mi-dinero/cuentas`, `/mi-plan/presupuestos`, `/mi-historia/insights`), **NO** al root que redirige (`/mi-dinero` → 308). Con `prefetch={true}` (full RSC prefetch), apuntar a la ruta real precarga el RSC **con datos** → navegación instantánea sin skeleton; apuntar a un redirect solo prefetchea el 308 y reintroduce el round-trip + skeleton de primera visita. El estado activo usa un campo `section` (prefijo de sección), separado del `href`. **Esto está validado en prod y es intocable: ninguna refactor/IA/reorganización de rutas posterior puede volver a poner redirects como blanco del nav del shell.** Si se agrega una sección nueva al nav, su `href` es el primer sub-tab real, no el índice que redirige. (Causa raíz histórica: la reorg IA v2 metió redirects y rompió esto; fix en `3f53482`.)
17. **La disposición del shell (web vs PWA) es INTOCABLE.** El layout del shell de `(app)` usa DOS modos, gateados por el custom-variant `standalone:` (que lee `<html data-standalone>` puesto por `StandaloneDetector`):
    - **Navegador (base, sin `standalone:`):** scrollea el `body`; el topbar es `sticky top-0`; la bottom-nav (`mobile-nav`) es `fixed bottom-0`; los `section-tabs` pegan con offset del topbar. Convive con la toolbar del navegador.
    - **PWA instalada (`standalone:max-md:`):** el `SidebarProvider` es una COLUMNA de **`100lvh`** (NO `100dvh` — en iOS standalone con status bar `black-translucent`, `dvh` mide la pantalla MENOS el status bar y deja hueco abajo), `flex-col`, `overflow-hidden`; el `body` NO scrollea; topbar y bottom-nav son items de flex (`shrink-0`), y SOLO `#main-content` scrollea entre ellos (`overflow-y-auto`). Así la nav queda físicamente pegada al borde inferior sin depender de `position:fixed`/safe-area (que iOS rompe). Los `section-tabs` pegan a `top-0` (el topbar ya está afuera del scroller).
    - **Reglas de oro de iOS PWA:** NUNCA `backdrop-filter`/`backdrop-blur` ni `transform`/`translateZ` sobre elementos `position:fixed` del shell (iOS los repinta mal / rompe el fixed). El safe-area va como `padding` con `env(safe-area-inset-*)` **directo** (NO vía custom property `var(--safe-*)`, que iOS puede resolver a 0). `viewport-fit=cover` + `appleWebApp.statusBarStyle='black-translucent'` en `layout.tsx` son parte del contrato.
    - **Esto costó múltiples iteraciones de depuración en dispositivo real y está validado.** Ninguna refactor/IA posterior puede tocar la disposición del shell, mezclar los dos modos, ni aplicar el app-shell de standalone al navegador (rompe la web). Detalle completo y la causa raíz medida (dvh=848 vs pantalla=896) en la memoria `reference-ios-pwa-shell`. Verificar SIEMPRE cambios de shell en el iPhone instalado, no solo en navegador.

## Blueprint

El blueprint completo y autocontenido vive en `docs/finanzia-blueprint.md`. Es la fuente de verdad si este archivo y el blueprint contradicen.
