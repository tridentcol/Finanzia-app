# Finanzia — Estado del proyecto

> Archivo vivo. **Actualízalo al cerrar cada step o al tomar una decisión que afecte el rumbo.**
> El builder lo lee al inicio de cada sesión para no perder continuidad.
>
> **Plan forward**: ver `docs/ROADMAP-NEXT.md` para el plan detallado de las próximas 6 fases (sprint de funcionalidades). Este archivo es retrospectivo (qué se hizo); el roadmap es prospectivo (qué viene).
>
> Última actualización: 2026-05-29 — **Sprint UX del copiloto (U1–U4)** ✅ completo. Sobre la base del Step 19 (LLM como cerebro + selector de motor), las cuatro fases de `docs/ux-sprint-plan.md`: **U1** estado humano "tool-aware" durante la generación (mapea los tool-calls del stream a frases es-CO, dot lavanda, estado terminal honesto si se corta); **U2** markdown limpio Noir en las respuestas del LLM (react-markdown + remark-gfm, números de lista en Geist Mono, sin HTML crudo); **U3** shell mobile rehecho (bottom-nav con FAB central = copiloto lavanda, sin pantalla "Más", config bajo el avatar en un Sheet, touch targets ≥44px); **U4** onboarding profundo (wizard `useReducer` que captura conocimiento/estilo/mini-test/foco) + personalización honesta por prompt (`persona.ts`: `derivePersona` determinista → snapshot lines + tone hints, editable en Ajustes). Una revisión adversarial (workflow) por fase, hallazgos corregidos. Sin migración SQL (todo en `profiles.aiProfile.persona`). **QA visual mobile pendiente del usuario**: `docs/qa-mobile-ux-sprint.md`. 7 commits nuevos sin pushear.

---

## Build Order — Estado

| # | Step | Estado | Notas |
|---|------|--------|-------|
| 1 | Scaffolding & base infra | ✅ hecho | Commit `chore: bootstrap finanzia repo (steps 1-2)` |
| 2 | Database — schema + migración + RLS + seed | ✅ hecho | DB aplicada al proyecto Supabase `anyinryjupznpouaxhtp` vía MCP. 55 categorías sistema sembradas. |
| 3 | Auth — Clerk + Third-Party Auth Supabase | ✅ hecho | Clerk con Sign in with Apple. Integración Third-Party Auth verificada (`/api/auth-check` mostró `sub` correcto, `iss=https://natural-doberman-90.clerk.accounts.dev`, `role=authenticated`, RLS filtra 1 fila). Usuario semilla: `78f6tpjfw5@privaterelay.appleid.com` con profile default COP/es-CO/America/Bogota. Webhook secret aún no configurado (se hace cuando haya dominio público); el `getCurrentUser()` lazy upsert cubre el gap. |
| 4 | Design system — tokens, fonts, theme | ✅ hecho | Tokens Noir hex en `globals.css` (light + dark). Fuentes: Inter (`--font-sans` con opsz axis), Geist Mono (`--font-mono`), Fraunces italic (`--font-editorial`). `src/lib/design/{tokens,icons}.ts` y `src/lib/motion/{easings,durations,variants}.ts`. `clerkAppearance` migrado a CSS vars. Clases utility: `.display`, `.editorial`, `.amount`. `prefers-reduced-motion` respetado. |
| 5 | Layout principal — Rail + Cmd+K + View transitions | ✅ hecho | `Rail` 56px (client, usePathname para active state, tooltips CSS-only). `Topbar` 56px con breadcrumb + ghost button "Buscar ⌘K". `CommandPalette` con cmdk + radix Dialog: navegación + sección IA placeholder con `accent-ai`. Listener global Cmd+K via Zustand store. ViewTransitions activadas: `rail-indicator` (animación del active mark) y `app-content` (crossfade del main). Páginas placeholder en `(app)/{cuentas,transacciones,categorias,presupuestos,metas,insights,ajustes}` con `EmptyState` editorial (Fraunces italic + body Inter). `categorias` ya carga las 55 sembradas via Drizzle. |
| 6 | CRUD cuentas + transacciones manual | ✅ hecho | UI base Noir en `src/components/ui/`. Helpers en `src/lib/currency/`. Server actions `createAccount`, `createTransaction`, `archiveAccount` con Zod + revalidatePath. Saldo computado vía CTE SQL (positive income, negative expense, transfers afectan ambos extremos). Página /cuentas con cards reales, /transacciones con tabla + filtros por kind, dashboard con saldo total agregado en moneda base. Cmd+K dispara los modales. Multi-divisa: cuenta tiene currency fija; transfers cross-currency bloqueadas hasta Step 8. amount_base mock 1:1 hasta Step 8. |
| 7 | Categorías + presupuestos | ✅ hecho | `createCategory`/`archiveCategory` (sistema queda read-only). Modal con icon picker (16 lucides) + paleta muted de 8 colores. `/categorias` separa "Tus categorías" vs "Sistema" con filtros por kind. `listBudgetsWithProgress` usa `date_trunc('month'/'week'/'year')` para resolver el período actual y suma `amount_base` de transacciones expense con `category_id` exacto. `BudgetProgressCard` con barra tonal (safe / warning / exceeded). Sección "Presupuestos del período" en dashboard. Cmd+K: + Nueva categoría, + Nuevo presupuesto. |
| 8 | Import CSV con mapping inteligente | ✅ hecho | Helpers `infer-columns` (heurística regex ES/EN) + `parse-row` (fecha ISO/DD-MM-YYYY, monto LATAM/EU, kind signed o split columns). Server action `runImport` crea batch, parsea, inserta en chunks de 200, marca status. `/importar/page.tsx` server component con `ImporterClient` (drop zone, mapping UI inferido, preview, headerRow ajustable) + sección "Imports recientes" con tabla. Cmd+K acción "Importar CSV" navega a `/importar`. Rail tiene item con icono `upload`. amount_base = amount_original 1:1 mock hasta Step 8b. |
| 8b | Tasas reales + cross-currency transfers | ✅ hecho | `src/lib/currency/rates.ts` (fetchDailyRates open.er-api.com, upsertRates onConflict, getRate con fallback al último ≤ fecha, convertAmount). Cron `/api/cron/exchange-rates` GET protegido por `Authorization: Bearer ${CRON_SECRET}`. `vercel.json` re-añadido con SOLO `crons` (0 6 * * *). Schema: columna `transfer_group_id uuid` + index. `createTransaction` ahora ramifica: same-currency = una fila, cross-currency = dos filas espejo con `transferGroupId` compartido (origen lleva `transferAccountId`, destino lleva `null` → CTE las maneja). `runImport` usa `convertAmount` por fila con cache por fecha. Dashboard convierte el balance de cada cuenta a base via `getRate`. Script `pnpm rates:fetch` para llenar tabla manualmente y backfillear txs con tasa mock. |
| 9 | Auto-categorización con IA + embeddings | ✅ hecho | `src/lib/ai/openai.ts` (cliente lazy, text-embedding-3-small, 1536 dim) + `src/lib/ai/anthropic.ts` (claude-sonnet-4-6). `embed-transaction.ts` normaliza texto (lower + NFD + strip bank prefixes/refs largas) y devuelve `number[1536]`. `categorize.ts`: kNN via pgvector `<=>` (top-5, filtra por user_id + kind), umbrales TOP1=0.85 / KNN_AVG=0.60; fallback `generateObject` con esquema Zod a Claude Sonnet 4.6 (umbral 0.55). `categorizeBatch` para imports usa `embedMany` (1 round-trip) y NO usa LLM. `recategorizeUnclassified(userId, {limit})` re-corre pending. Hooks: `createTransaction` (inline si no hay categoryId del usuario), `runImport` (batch antes del insert), action `setTransactionCategory` (re-embed + user_corrected=true). UI: `CategoryCell` (Radix Select inline en la tabla + sparkle accent-ai + tooltip de confidence) + `RecategorizeButton` (server action bulkRecategorize, muestra count pending en header). Degradación grácil sin keys (return null + toast informativo). |
| 10 | Insights engine + cron diario | ✅ hecho | `src/lib/ai/insights/{anomaly,trend,forecast,recommendation}.ts` + `index.ts` runner. anomaly: z-score >= 2σ sobre total semanal vs 8 semanas baseline; trend: |Δ%| >= 15% entre primer/último mes cerrado (top-8 cats); forecast: spend_rate × dias_totales > 1.1 × budget (solo monthly, dias_elapsed >= 5); recommendation: Claude Sonnet 4.6 `generateObject` con snapshot agregado (no transacciones individuales). Dedupe por `data.signature` en ventana 24h. Cron `/api/cron/insights` (`0 5 * * *`) en `vercel.json`, GET protegido por `CRON_SECRET`, itera `getActiveUserIds()` (txs últimos 60d). UI: `/insights/page.tsx` con filtros por kind + `InsightCard` (severity dot tonal, sparkle accent-ai si AI, botón acción → href derivado del JSON `action`, dismiss + mark-acted). Server actions `dismissInsight` / `markInsightActed` / `markInsightRead` / `runInsightsNow`. Sección "Lecturas recientes" en dashboard con top 3 unread + `RunInsightsButton`. |
| 11 | Copiloto Finanzia con tool-calling | ✅ hecho | `src/lib/ai/copilot/`: 7 tools scopeados por closure al userId — read: `getBalance`, `listRecentTransactions`, `getBudgetStatus`, `listActiveInsights`, `searchTransactions` (ILIKE en description/merchant + agregado en base); propose: `proposeCreateTransaction`, `proposeSetBudget` (validan referencias y devuelven JSON, no mutan). `runCopilotChat` con `streamText` + `convertToModelMessages` (async en v6) + `stepCountIs(5)`. System prompt español sobrio fuerza regla 6 (propose-* nunca ejecuta). Endpoint `/api/ai/chat` POST persiste turnos en `conversations` + `messages` vía `onFinish`. Header `x-conversation-id` para reuso. UI: `CopilotDialog` con `useChat` (`@ai-sdk/react@3.0.193`), itera `message.parts`: text bubble + tool badges + `ProposalCard` con summary tabular y botones Confirmar/Descartar → server actions `confirmProposedTransaction` / `confirmProposedBudget` (delega en `createTransaction` para no duplicar lógica). Atajo global `⌘J`; item "Preguntar a Finanzia" habilitado en Cmd+K. Degrada al heurístico sin LLM. |
| 12a | Integraciones IA por usuario (Vault) | ✅ hecho | Tabla `user_integrations` (user_id, provider, secret_id uuid → vault.secrets, scopes, status). Migración `drizzle/migrations/0001`. Helpers en `src/lib/integrations/store.ts`: upsert/remove/getUserApiKey (lee vault.decrypted_secrets server-side), listUserIntegrations (metadata, sin key). `/ajustes/integraciones` UI con cards por provider + dialog conectar/reemplazar/quitar + scopes (embed/chat). Clientes lazy `getAnthropic({userId})` / `getOpenAI({userId, scope})` resuelven en cascada: user Vault → AI Gateway env → env operador. Env nueva `AI_GATEWAY_API_KEY`. Toda la cadena de IA (categorize, embed, recommendation, copilot) propaga `userId`. |
| 12b | Motor heurístico interno | ✅ hecho | `src/lib/heuristic/`: 6 intents (saldo, gasto por categoría, presupuestos, lecturas, búsqueda, resumen) + help, con detección de periodo natural ("este mes", "mes pasado", "últimos 7 días"). Intent parser por keywords + regex. `runHeuristic` ejecuta y `formatHeuristicMarkdown` convierte a Markdown. `merchants.ts` con ~90 reglas regex LATAM (Uber/Didi/Rappi/Netflix/EPM/etc.) → categorías del seed. `categorize.ts` aplica merchant rules como fallback final cuando kNN/LLM no alcanzan umbral (también funciona sin OpenAI). `/api/ai/chat` enruta a heurístico cuando no hay Anthropic disponible y emite UIMessageStream falsificado via `createUIMessageStream` (cliente useChat no distingue). |
| 12c | Sidebar 240px + bottom nav mobile | ✅ hecho | Nuevo `Sidebar` 240px labeled (Linear/Mercury style) con secciones Visión general / Operación / Inteligencia + UserButton abajo. Visible `lg:`. `MobileNav` bottom nav 5 items con safe-area-inset-bottom. `Topbar` adaptable: mobile = brand + título compacto + buscador icon-only + spark; desktop = título grande + buscador con shortcut. Dialog base, CommandPalette y CopilotDialog full-screen en mobile (inset-0 max-md), modal centrado >=sm. Input `h-11` mobile / `h-10` desktop para touch target. Layout grid `lg:pl-[240px]` + `pb-[80px]` mobile. Borrado `rail.tsx`. |
| 12d | Mobile pass tablas + páginas | ✅ hecho | `/transacciones`: cards apiladas `<md` con descripción / fecha / cuenta / amount + CategoryCell debajo; tabla `>=md`. Dashboard: bajar tipografía del display total `text-[40px] sm:text-5xl lg:text-6xl`, gaps responsive. Páginas restantes hacen wrap natural por el grid existente. |
| 12e | Detectores extra de Insights | ✅ hecho | `savings-rate.ts` compara la tasa de ahorro del último mes vs promedio de 3 meses previos; <-15pp → 'recommendation' notice, +10pp → 'achievement'. `dormancy.ts` flaggea cuentas sin movimiento >45 días con saldo > 50k base. `recurring-detection.ts` busca merchants con ≥3 ocurrencias en 90 días con intervalo medio mensual (22-38 días) sin `recurring_rule_id` y sugiere registrarlo. Todos integrados en `runDetectorsForUser`. |
| 13a | Goals (metas) | ✅ hecho | Schema ya existía. Server actions `createGoal/adjustGoalProgress/archiveGoal` en `metas/actions.ts`. `listGoalsForUser` query agrega percent + daysToTarget. UI: `/metas/page.tsx` con `GoalCard` (barra de progreso tonal, "Aportar" inline con form colapsado, "Abandonar"). `NewGoalDialog` con nombre/monto/fecha/moneda/cuenta vinculada/aporte inicial. Cmd+K via `new-goal` dialog id. |
| 13b | Tarjetas de crédito UI | ✅ hecho | `listAccountsWithBalance` expone `statementDay` y `paymentDay`. `/cuentas` para `type='credit_card'` renderiza panel extra: porcentaje utilizado con barra tonal (safe<60%, warning>=60%, negative>=90%), disponible/cupo, día corte + días faltantes, día pago + días faltantes. |
| 13c | Alerts engine + UI | ✅ hecho | Schema ya existía. `queries/alerts.ts` (listAlertsForUser, countUnreadAlerts). `alert-mirror.ts`: el runner de insights espeja `anomaly notice/warning` → `unusual_spend`, `forecast warning` → `budget_exceeded` (dedupe por mensaje en 24h). `/ajustes/alertas` con `AlertList` (mark read/all read/delete). `AlertsBell` en Topbar con badge accent-ai + polling cada 60s a `/api/alerts/count`. Card de Alertas en hub `/ajustes` con dot si hay unread. |
| 13d | Recurring rules | ✅ hecho | Schema ya existía. `queries/recurring.ts` (list). `src/lib/recurring/tick.ts` con `tickRule` (1 fila, convertAmount → base, inserta tx + avanza nextRun) y `runRecurringForUser` (catch-up con safety cap 50). Si `autoCreate=false`, en lugar de tx se crea alert `recurring_due`. `/ajustes/recurring` page + `NewRecurringDialog` (description/cuenta/categoría/amount/frequency/nextRun/autoCreate). Server actions create/toggle/delete/runNow. Cron `/api/cron/recurring` (`0 4 * * *`) en `vercel.json` itera `listUsersWithDueRules`. |
| 14a | Bug crítico: Select dropdown clippeado | ✅ hecho | `SelectContent` no tenía `max-h` ni overflow en el `Viewport`, así que cuando la lista de categorías superaba el viewport (típicamente después de "Transporte" dentro del Dialog "Nueva transacción") los items debajo quedaban inaccesibles. Fix: `max-h-[var(--radix-select-content-available-height)]` en Content + `flex flex-col`, Viewport `flex-1 overflow-y-auto`, agregados `SelectScrollUpButton`/`SelectScrollDownButton` para feedback, `collisionPadding 12px` + `sideOffset 6px`, `z-[60]` para layering sobre Dialog backdrop. |
| 14b | Performance navegación | ✅ hecho | `::view-transition-*` global bajó a 180ms (antes 320ms) y `app-content` a 140ms (antes 220ms). Sidebar active dot dejó de envolverse en `<ViewTransition name="sidebar-indicator">` — disparaba named transitions por cada cambio de ruta sin valor visual. CategoryCell ya no llama `router.refresh()` — la action ya revalida `/transacciones`/`/presupuestos`/`/dashboard`. |
| 14c | Mobile nav incompleta | ✅ hecho | Nuevo `MobileMoreSheet` (Dialog full-screen en mobile) con secciones Operación (Importar/Categorías/Presupuestos/Metas) + Configuración (Ajustes/Integraciones/Recurring/Alertas) + UserButton. `MobileNav`: 4 links primarios + botón "Más" que abre el sheet (antes navegaba a `/ajustes` y dejaba inaccesibles las secciones). Sheet se autocierra al cambiar ruta. |
| 14d | Mobile overflow horizontal | ✅ hecho | Pasada page-by-page en 375/412px. Pattern: `min-w-0` en flex containers padre cuyas children tengan texto largo, `truncate` + `shrink-0` estratégico en headers, `flex-wrap` en headers de página, filtros con `overflow-x-auto` + `whitespace-nowrap`, titulares responsive (text-2xl sm:text-3xl). Dashboard hero Amount: `text-[28px] sm:text-4xl md:text-5xl lg:text-6xl` (antes `text-[40px]` reventaba con totales COP altos). Tarjeta crédito: `formatMoney(compact)` y "día N · en Nd" en vez de bare numbers + "faltan N días". `/importar` imports recientes: cards apiladas `<md`, tabla `>=md`. `recurring-list` en mobile apila acciones debajo. |
| 14e | Polish /ajustes + accesibilidad + sonner + safe-area | ✅ hecho | `/ajustes` refactor a array `settings[]` con render unificado (`min-h-[64px]`, `aria-label` completo, dot accent-ai con `aria-live` para badge unread). Row de perfil con `truncate` para no romper si email es largo. Sonner `position="top-center"` con `offset: 20` (antes `bottom-right` se solapaba con MobileNav). Copilot input `min-h-[44px]` touch target + `padding-bottom: max(0.5rem, env(safe-area-inset-bottom))` para iOS. |
| 14f | Perf nav: View Transitions OUT + shadcn sidebar IN | ✅ hecho | Lag entre rutas reportado por el usuario incluso después de 14b. **Causa raíz**: la API experimental `<ViewTransition>` de React 19/Next 16 envolvía `{children}` y forzaba al browser a snapshot completo del DOM antes/después de cada navegación — fácilmente 200-500ms. Removida por completo (`(app)/layout.tsx` + reglas `::view-transition-*` en globals.css). Migrado el sidebar custom 240px a **shadcn sidebar** (`npx shadcn add sidebar` → instala sidebar + sheet + tooltip + separator + skeleton + use-mobile). `AppSidebar` con `collapsible="icon"` colapsa a rail en desktop (cookie `sidebar_state`, atajo `Cmd+B`). `TooltipProvider` añadido al root layout. Tokens `--sidebar-*` mapeados a Noir en `:root` y `.dark`. `use-mobile.ts` con initial state sin setState-in-effect (fix React Compiler). Restaurados `button.tsx`+`input.tsx` (shadcn los había pisado con su escala default). |
| 14g | Mobile: bottom-nav + sheet Más (estándar fintech) | ✅ hecho | El sheet mobile nativo del shadcn sidebar quedaba detrás de un hamburger oculto — peor descubrimiento. Decisión UX: en mobile (<md) **NO** se usa shadcn sidebar; se monta bottom-nav fijo con 4 tabs (Resumen/Cuentas/Bitácora/Insights) + botón Más que abre `MobileMoreSheet` (Dialog full-screen con Importar/Categorías/Presupuestos/Metas/Ajustes/Integraciones/Recurring/Alertas + UserButton). Es el patrón de Mercury/Revolut/Wise/Cash App — pulgar alcanza la base, destinos clave siempre visibles, sin descubrir un drawer. `AppSidebar` retorna `null` si `useSidebar().isMobile`. `SidebarTrigger` en Topbar oculto `<md` y restaurado brand mark Finanzia. Layout añade `<MobileNav/>` + `pb-[88px] md:pb-10` para no chocar con el nav fijo. Breakpoints unificados a `md` (768px) para coincidir con `useIsMobile()` shadcn. |
| 15a | Brand Horizonte: símbolo + wordmark + tokens morados | ✅ hecho | Sistema de marca del `design_handoff_finanzia_brand/` integrado. Sora 500 cargada vía `next/font/google` (variable `--font-brand`). Componentes nuevos en `src/components/brand/`: `BrandMark` (3 paths SVG idénticos al `mark-color.svg`, fills por CSS var `--brand-mark-{ring,center}` que mutan light/dark), `BrandWordmark` ("finanzia" lowercase tracking -0.05em line-height 1). Tokens nuevos en `globals.css`: `--brand-purple-{strong,deep,soft}` (`#7C3AED/#4C1D95/#A78BFA` del handoff). En dark, anillos `soft` + disco `strong` para legibilidad sobre `#0A0A0B`; en light, variante canónica. `--accent-ai` lavanda **intacto** — sigue exclusivo de presencia IA (mandato regla 13 refinado, no contradicho). Aplicado en sidebar header (símbolo + wordmark cuando expandido; solo símbolo cuando colapsado, centrado en cuadrado 32×32 con `self-center`), topbar mobile (solo símbolo al lado del título dinámico), landing y auth header. Favicon `src/app/icon.svg` con variante canónica del handoff. Metadata `title` ahora "finanzia" lowercase coherente con wordmark. |
| 15b | Sidebar hover/active con tinte morado sutil | ✅ hecho | Override del comportamiento default del shadcn `SidebarMenuButton` vía clase custom `navItemClass` en `app-sidebar.tsx`. Hover: `color-mix(in oklab, var(--brand-purple-strong) 10%, transparent)` en dark, 6% en light. Active: 18% dark, 12% light. Variables `--nav-hover-bg` y `--nav-active-bg` envueltas en `@supports (color: color-mix(...))` con fallback a strong sólido. Bottom-nav indicador activo migrado de `--accent-ai` a `--brand-purple-strong`. |
| 15c | Landing rediseñada con vida | ✅ hecho | Hero con watermark del símbolo a 6-8% opacity (decorativo, abs positioned), palabra "sentido" en `--brand-purple-soft`, pre-headline tracking-wide. Banda intermedia con `color-mix var(--brand-purple-strong) 5%` y 3 pilares (∞ / IA / COP·USD) con números display en `--brand-purple-soft`. Cierre editorial Fraunces italic. Footer con lockup pequeño + "Hecho en Colombia". Mandato Noir respetado: sin gradientes, sin glow, sin emojis. Reemplaza la versión minimal anterior que el usuario consideraba "poco viva". |
| 15d | Perf nav: residuo de ViewTransition removido | ✅ hecho | El commit `cb604a7` (14f) había sacado el uso de `<ViewTransition>` en el código pero dejó `experimental.viewTransition: true` en `next.config.ts`. La flag sigue habilitando la integración en el cliente aunque no se use explícitamente, contribuyendo a latencia percibida entre rutas. Removida la flag. Sin `loading.tsx` en segmentos: la app espera el RSC completo antes de cambiar de ruta — si el delay persiste, añadir loading.tsx por segmento sería el siguiente paso. |
| 15e | Sección Deudas (schema + página + dialog + nav) | ✅ hecho | Schema: enums `debt_type` (loan_personal, mortgage, auto_loan, student_loan, family_loan, other) y `debt_status` (active, paid, defaulted), tabla `debts` con principal/currentBalance/interestRate/installmentAmount/termMonths/originDate/nextPaymentDate/paymentDay/linkedAccountId/notes. RLS por clerk_id, dos índices (`user`, `user+status`). Migration Drizzle consolidada en `0001_user_integrations_transfer_group_debts.sql` idempotente (incluye user_integrations + transfer_group_id históricos para alinear el journal con la DB real). Aplicada a prod vía Supabase MCP `apply_migration`. Queries: `listDebts`, `getDebtById`, `getDebtsSummary` (convierte saldos a base currency + próximo pago más cercano). Server actions: `createDebt`, `updateDebt`, `archiveDebt`, `markDebtPaid`. Página `/deudas`: header con saldo total + meta deudas activas + total tarjetas (compact), banda destacada con próximo pago (tinte morado 5%), sección "Tarjetas de crédito" (resumen de `accounts.credit_card` con utilización), sección "Préstamos y otras deudas" con DebtCard rica (saldo / cuota / plazo / avance %, dl footer con interés/próximo pago/día corte/origen + notas), histórico (paid/defaulted). Empty state editorial. `NewDebtDialog` con Sora-free form de 11 campos. Items "Deudas" añadidos al sidebar (sección Operación, icon `landmark`), `MobileMoreSheet` y mapa de titles del topbar. **Tarjetas siguen en `accounts.credit_card`** — la página `/deudas` unifica visualmente ambos modelos sin migrar datos. |
| 15f | Dashboard: widgets de deuda + breakdown por categoría | ✅ hecho | `DebtsSummaryCard` (suma saldo total adeudado = `debts.currentBalance` + tarjetas con balance negativo, todo en base currency; próximo pago destacado; tinte morado 6%; link a `/deudas`). `CategoryBreakdown` con barra apilada de 6 tonos morados (`deep`, `mid`, `base`, `8B5CF6`, `light`, `pale`) + lista editorial con cuadrito de color + ícono lucide + nombre + % + monto. Query `getExpensesByParentCategory` resuelve subcategorías a su padre raíz (`COALESCE(parent_id, id)`), agrupa por padre y suma `amount_base` del mes actual. Solo muestra categorías con datos. Ambos widgets insertados después de "Tus cuentas" y antes de "Últimos movimientos". |
| 16a | Batching de tasas de cambio | ✅ hecho | Nueva función `getRatesForPairs(pairs, date)` en `src/lib/currency/rates.ts` que resuelve N pares en una sola query SQL (`DISTINCT ON + JOIN VALUES`, preserva el fallback al último rate ≤ date por par). `getTotalBalanceInBase` ahora acepta `preloadedAccounts?` opcional → el dashboard pasa su `accountsList` y elimina la query duplicada (antes hacía 2 CTE idénticas de `listAccountsWithBalance` en paralelo). `getDebtsSummary` también refactorizada al batch. Dashboard inlinea la conversión y comparte el mismo Map de tasas entre saldo total y deuda de tarjetas (antes eran dos loops `for await` independientes). Resultado: ~13 round-trips Supabase menos por render de dashboard con usuario multi-divisa. `getRate` y `convertAmount` se mantienen intactos para callers single-conversion (transactions, importar, recurring, debts.actions). |
| 16b | Lazy dialogs vía Suspense + 13 `loading.tsx` por ruta | ✅ hecho | Nuevo `src/components/app/dialogs-bundle.tsx` Server Component agrupa los 6 dialogs data-dependientes (NewTransaction, NewCategory, EditCategory, NewBudget, NewGoal, NewRecurring). Layout lo monta dentro de `<Suspense fallback={null}>` → la navegación entre rutas ya no espera por `listUserAccountsBasic` ni `listAvailableCategories`; estos streamea cuando lleguen. Los dialogs sin data (NewAccount, NewDebt, Copilot) siguen inline. + 13 `loading.tsx` por segmento (`/dashboard`, `/cuentas`, `/transacciones`, `/deudas`, `/metas`, `/categorias`, `/presupuestos`, `/insights`, `/importar`, `/ajustes`, `/ajustes/alertas`, `/ajustes/recurring`, `/ajustes/integraciones`) usando `<Skeleton>` con `animate-pulse` (opacity-based, sin shimmer) sobre `bg-muted` → `--surface-hover` Noir. Estructura mirror exacto de cada página para evitar CLS. Cards mantienen su `border` + `bg-surface` real, solo el contenido interno es skeleton — se siente parte del producto. |
| 16c | Pin Vercel region a `pdx1` | ✅ hecho | `vercel.json` añade `"regions": ["pdx1"]` (Portland, co-localizado con Supabase `us-west-2`). Antes Vercel default `iad1` (us-east-1) pagaba ~70ms RTT cross-region por cada query Drizzle; con pdx1 → us-west-2 baja a ~10ms. Dashboard tiene 4 bursts secuenciales antes de paint (`requireCurrentUser` → `profiles.findFirst` → 6×parallel queries → `getRatesForPairs`), o sea ~240ms ahorrados por navegación. Beneficio especialmente notorio en mobile celular donde el RTT del usuario al edge ya es alto. Verificado vía `vercel inspect`: todas las functions (`_global-error`, `.rsc`, etc.) listadas en `[pdx1]`. |
| 16d | Prefetch agresivo en mobile-nav y sheet "Más" | ✅ hecho | Next limita el viewport-prefetch en conexiones lentas (`navigator.connection.effectiveType` 3g/4g detection), así que en mobile celular el skeleton de la nav se veía más que en desktop. Tres jugadas: (1) `MobileNav` al montar hace `router.prefetch()` loop sobre las 4 rutas primarias del bottom-nav (Resumen/Cuentas/Bitácora/Insights) para calentar el RSC en cuanto la app es interactiva; (2) cada Link del bottom-nav lleva `prefetch={true}` explícito (full RSC, no solo loading.tsx) + `onTouchStart={() => router.prefetch(href)}` para adelantar la descarga ~100ms antes del click event; (3) `MobileMoreSheet` cuando se abre dispara `router.prefetch()` para los 9 items del sheet (el IntersectionObserver del `<Link>` no los ve mientras el Dialog está cerrado) + onTouchStart en cada link. Usuario confirma feel mobile cerca al desktop. |
| 17a | Foundation visual de tarjetas (parcial) | ✅ hecho — sin imágenes ni push |
| 17b | Catálogo tarjetas ampliado (13 bancos) + decisiones sprint | ✅ hecho |
| 18a | Onboarding + Perfil de Ahorro (Fase 1) | ✅ hecho |
| 19a | LLM (OpenAI gpt-5.4-mini) como cerebro del copiloto | ✅ hecho | Config por env en `src/lib/ai/copilot/config.ts` (`COPILOT_LLM_PROVIDER` default openai, `COPILOT_LLM_MODEL` default gpt-5.4-mini, `REASONING_EFFORT` medium, `TEXT_VERBOSITY` low, `STORE` false, `FORCE_LLM` override operador). `resolveCopilotProvider` (openai scope chat / anthropic) + `runCopilotChat` con `providerOptions.openai` (reasoning/verbosity/store, sin temperature) + `stopWhen(8)`. Probe `pnpm probe:llm` (cae a gpt-5-mini). `@ai-sdk/openai@3.0.65` ya soporta gpt-5.4-mini + reasoning params (sin upgrade). Doc: `docs/copilot-llm.md`. |
| 19b | Catálogo de tools de lectura + queryTransactions | ✅ hecho | Tools read-only compactos (filtran por userId): getBalance, getAccounts, listRecentTransactions, searchTransactions, **queryTransactions** (reusa el motor IR `src/lib/copilot/query/*` → cifras EXACTAS), getBudgetStatus, getDebts, listRecurring, getSavings, listGoals, getTopMerchants, getCashFlow, listActiveInsights, getAdvice (corre los detectores locales en vivo). `propose-*` intactos (mutación con confirmación). |
| 19c | Profile snapshot + system prompt asesor + confirm-card LLM | ✅ hecho | `src/lib/ai/copilot/profile-snapshot.ts` (compacto, reusa queries, Promise.allSettled) inyectado al system prompt reescrito a asesor financiero es-CO/COP/Noir. Tarjeta de confirmación para propuestas del LLM: `llm-to-ast.ts` detecta tool-outputs proposeCreateTransaction/proposeSetBudget → ProposalAction → AnswerActions confirma vía server actions existentes (guard anti-doble-registro). |
| 19d | Selector de motor en el copiloto (default Local) | ✅ hecho | `aiProfile.copilot.routing` ('local' default \| 'llm'); el route va al LLM solo si routing='llm' o COPILOT_FORCE_LLM (sin auto-defer). DropdownMenu discreto en el header del copiloto (`src/components/copilot/engine-menu.tsx`): el badge muestra el modelo (punto lavanda) o "Local"; lista solo modelos con key integrada (Vault scope chat o key operador). Actions `getCopilotChoices`/`setCopilotEngine` (atómicas, FOR UPDATE). Se eliminó el selector de Ajustes (consolidado en el copiloto). 3 revisiones adversariales (workflows) con fixes (catálogo modelo↔provider, lectura de perfil deduplicada, lost-update, back-compat de routing, header mobile encogible). |
| 18b | Savings Tracker Histórico + Proyección (Fase 2) | ✅ hecho | Migración `0002_card_visual_identity.sql` añade a `accounts` cinco columnas opcionales (`bank_slug`, `card_product_slug`, `card_brand`, `card_last_four`, `card_holder_name`) — aplicada a prod via Supabase MCP. `kind` (credit/debit) se deriva de `account.type`, no se almacena. Catálogo curado `src/lib/cards/catalog.ts` con 9 bancos colombianos (Bancolombia, Davivienda, Nu, RappiCard, Falabella, BBVA, Scotiabank Colpatria, Banco de Bogotá, "Otro") y ~22 productos crédito/débito; helpers `findCardProduct` / `findBank`. `<CardVisual>` (client component, aspect 1.585:1, Next/Image con onError → placeholder neutral con wordmark cuando la imagen no existe en disco). `NewAccountDialog` rediseñado con sección "Identidad visual" cascada (banco → producto → red → últimos 4 + titular) y preview vivo. `/cuentas` y `/deudas` muestran `<CardVisual>` arriba del card cuando `bankSlug` está set. `/public/cards/README.md` documenta naming + specs. **Pendiente**: dropear imágenes en `/public/cards/`, dialog de edición visual para cuentas existentes, push del commit `7c212ad`. El plan completo Fase 4 (incluido 4b motor + Vision, 4c mecánica, 4d analizador) vive en `docs/ROADMAP-NEXT.md`. |
| U1 | Estado humano "tool-aware" durante la generación | ✅ hecho | `src/lib/copilot/parts.ts` (narrowing compartido de tool parts del AI SDK v6) + `render/copilot-phase.ts` (`TOOL_LABELS` + `derivePhase` puro, +test). `copilot-status.tsx` (reemplaza typing-indicator): dot lavanda + frase con fade-in por cambio, `role=status`/`aria-live`, texto en `text-secondary` (AA). El turno pending lleva `phase`, derivada sólo del último mensaje en streaming; estado terminal `idle` honesto si el stream corta sin texto (Detener/error/límite de pasos). Revisión adversarial: 3 fixes (pending eterno, contraste, naming cross-fade). Commit `2700f6e`. |
| U2 | Markdown limpio Noir en respuestas del LLM | ✅ hecho | `react-markdown@10` + `remark-gfm@4` (NO streamdown — verificado: sin mermaid ni rehype-raw). Nuevo bloque AST `{type:'markdown'}`; `llm-to-ast` lo emite para el texto del LLM (heurístico sigue con `text`). `markdown-prose.tsx`: map Noir restringido (sin HTML crudo/img, `urlTransform` http/https/mailto, code chip, eyebrow h1-6, tablas), números de lista ordenada en Geist Mono tabular vía contadores CSS `.md-prose`. System prompt refuerza listas/pasos. Revisión: 2 fixes (marcadores a `text-secondary` AA, prompt anti-checkbox). Commit `2e6c181`. |
| U3 | Layout mobile: copiloto FAB central, sin "Más" | ✅ hecho | Bottom-nav = Hoy · Mi dinero · [FAB copiloto lavanda `accent-ai`] · Mi plan · Mi historia (eliminado `mobile-more-sheet`). `mobile-account-sheet.tsx` (Sheet bottom bajo el avatar): Ajustes/Categorías/Integraciones IA/Importar + UserButton, cierra en cambio de ruta vía `useRef` (sin eslint-disable). Topbar mobile con targets ≥44px (Registrar morado, Buscar, campana, avatar); "Preguntar" pasa a sólo-desktop. `alerts-bell` 44px mobile. Altura del topbar sin cambios (56px) para no romper sticky `--topbar-total`. Workflow de review falló por infra (verificadores sin StructuredOutput, ~2h) → revisión manual: 1 fix (eslint-disable → `useRef`). Commit `bc2aa0b`. **QA visual pendiente del usuario.** |
| U4 | Onboarding profundo + personalización por prompt | ✅ hecho | `persona.ts` (isomorfo): enums + 3 preguntas (score), `personaSchema`/`testAnswersSchema` Zod, `derivePersona` puro y determinista (moneyStyle←P1+P3, horizon←P2, riskTolerance←P2+P3), `personaToSnapshotLines`/`personaToToneHints`, +19 tests. Snapshot inyecta líneas de persona; `buildSystemPrompt` acepta `toneHints` (bloque condicional); `buildProfileSnapshot` devuelve `{text, toneHints}` de una sola lectura. `completeOnboarding` persiste `aiProfile.persona` + riskTolerance top-level con `FOR UPDATE` (arregla lost-update). Onboarding refactor a orquestador `useReducer` + `onboarding/` (chip + steps). Tarjeta "Cómo te habla el copiloto" en Ajustes. Revisión adversarial (lean, 4 dim): 8 fixes (DialogTitle a11y, lectura redundante, safe-area/flex mobile del wizard, testAnswers enum, dedup de foco en prompt, hint de verbosidad, validación monto fijo). Sin migración SQL. Commits `bd2e341`/`ffbf060`/`145729c`. |

---

## Next action

**Sprint UX del copiloto (U1–U4) ✅ completo** (2026-05-29). Plan en `docs/ux-sprint-plan.md`; ver la tabla de arriba (filas U1–U4) para el detalle de cada fase. 7 commits nuevos sin pushear (`git log origin/main..main`); el push lo hace el usuario.

**Pendiente inmediato:**
1. **QA visual mobile (usuario)** — checklist en `docs/qa-mobile-ux-sprint.md` (320–430px). El agente no puede renderizar la ruta autenticada (Clerk) headless. Foco: bottom-nav/topbar a 320px, safe-area del wizard en PWA iOS, y el smoke test de personalización (literacy/commStyle observable con un modelo de IA).
2. **Push** de los 6 commits cuando el QA pase.

**Notas de implementación (desvíos del plan, ya reconciliados):** las rutas son la reorg IA v2 (`/dashboard`, `/mi-dinero/*`, `/mi-plan/*`, `/mi-historia/*`); el topbar mantuvo 56px (los targets de 44px caben, evita romper sticky `--topbar-total`); Importar quedó en el account sheet (su CTA contextual aún no existe); el wizard quedó en ~10 pantallas de una decisión c/u (el mini-test como 3 sub).

---

### Operativo pendiente (pre-existente)

**Solo polish + go-live final.**

Producto cerrado al MVP funcional. Lo que queda es operativo:

1. **Pegar claves opcionales en Vercel** (si quieres activar IA además del heurístico):
   - `OPENAI_API_KEY` para embeddings/auto-categorización (~$0.02 por 1M tokens, baratísimo).
   - `ANTHROPIC_API_KEY` para copiloto y recommendations.
   - O alternativamente `AI_GATEWAY_API_KEY` (Vercel AI Gateway, free tier $5/mes incluye Anthropic + OpenAI).
   - `vercel env add OPENAI_API_KEY production "" --value "sk-…" --yes --force` (repetir preview).
2. **Aplicar migración 0001** si Supabase no la corrió aún (en este proyecto ya está aplicada vía MCP). En otro entorno: `pnpm db:bootstrap` corre extensions + rls.sql; las migraciones drizzle se aplican con `pnpm db:migrate` o copiando el SQL.
3. **Switch Clerk a producción** cuando se quiera ir con `pk_live_*`. Tocar también el Issuer URL de Clerk en Supabase Third-Party Auth.
4. **Dominio custom** en Vercel + en Clerk Allowed Origins.
5. **QA pass** completo: crear cuenta, importar CSV real, crear meta + aportar, crear recurring + correr cron manualmente, registrar tx desde copiloto heurístico, conectar key y probar LLM, dismiss alerts. Si algún flujo se rompe, ahí lo arreglamos.

Después: roadmap fuera del MVP — multi-tenant strict (auth context propago a queries, no solo filtros), Trigger.dev para imports masivos, Sentry, internacionalización de la base currency, etc. 

Último step del MVP. Toca lo que queda para que la app sea usable como producto.

1. **Metas (`goals`)** — schema ya existe. CRUD básico: nombre, target_amount + currency, target_date, linked_account_id. Página `/metas` con cards de progreso (current_amount / target_amount). Cron diario o trigger en `createTransaction` que actualiza `current_amount` cuando se deposita en `linked_account_id`. Modal Cmd+K "Nueva meta".
2. **Recurring (`recurring_rules`)** — schema ya existe. CRUD con frequency (daily/weekly/biweekly/monthly/quarterly/yearly). Cron `/api/cron/recurring` (`0 4 * * *`): por cada rule activa con `next_run <= today`, crear la tx (con su category, etc.) y avanzar `next_run`. Página `/ajustes/recurring` lista las reglas y permite pausar/desactivar.
3. **Tarjetas de crédito** — UI específica para `accounts` con `type='credit_card'`. En `/cuentas`, las tarjetas muestran: saldo actual, límite, día de corte, día de pago, deuda del corte actual, fecha próximo pago. Pequeña card extra en dashboard para próximos vencimientos.
4. **Alertas (`alerts`)** — schema ya existe. Generadores: `unusual_spend` (piggy del insight anomaly), `budget_exceeded` (cuando el cron de insights detecta forecast exceeded), `recurring_due` (cron de recurring genera la alert si hay >1 día en mora), `low_balance` (cuando una cuenta queda <5% del avg_balance), `goal_at_risk` (cuando el ritmo no llega al target_date). UI: badge de notificaciones en Topbar + página `/ajustes/alertas`.
5. **Deploy prod final**:
   - Switch Clerk → instancia production (`pk_live_*`, `sk_live_*`); re-pegar en Vercel.
   - Configurar dominio custom si aplica.
   - Verificar Sentry + observabilidad (Sentry queda opcional pero recomendado).
   - `pnpm rates:fetch` o primer cron run para llenar `exchange_rates` con datos prod.
   - QA pass: crear cuenta, importar CSV, recategorizar, generar insights, abrir copiloto, registrar transacción vía copilot, ajustar presupuesto.

**Operacional Step 11**:
- Pegar `ANTHROPIC_API_KEY` en `.env.local` y Vercel para activar el copiloto. Sin key, el endpoint devuelve 503 y la UI muestra el error.
- Probar: `⌘K → "Preguntar a Finanzia"` o `⌘J` → preguntas tipo "saldo total", "gasto en restaurantes este mes", "pónme un presupuesto de 1M en Restaurantes" (debería disparar `proposeSetBudget` y mostrar tarjeta).
- Cada turno se persiste en `conversations` + `messages` con el tool_calls y tool_results en JSON.

**Operacional Step 10**:
- El cron corre `0 5 * * *` UTC en Vercel. Primera ejecución mañana. Para validar ahora: abre `/insights` → "Analizar ahora" (server action `runInsightsNow`), o hit el endpoint con `curl -H "Authorization: Bearer $CRON_SECRET" https://finanzia-app-six.vercel.app/api/cron/insights`.
- Insights LLM (recommendation kind) requieren `ANTHROPIC_API_KEY` pegada en Vercel. Sin key, solo se generan anomaly/trend/forecast.
- Los detectores SQL son sensibles a tener volumen de datos: anomaly necesita >=4 semanas previas; trend >=2 meses cerrados; forecast cualquier presupuesto monthly con >=5 días elapsed.

**Operacional Step 9**:
- Pegar `OPENAI_API_KEY` y `ANTHROPIC_API_KEY` en `.env.local` y en Vercel (production + preview).
- Test rápido: crear una tx manual con descripción "Uber al aeropuerto" → embedding + kNN devuelve null (cold start) → fallback LLM debería elegir "Transporte" con confidence ~0.8.
- Tras unas decenas de transacciones, las nuevas se categorizan via kNN sin tocar el LLM (más rápido y barato).

**Smoke test pendiente** (no bloquea): probar import con CSV real de banco LATAM y confirmar heurísticas.

---

## Decisiones tomadas para Deploy / Vercel

(Sección posterior por trazabilidad)

Step crítico: aquí la app pasa de "registro manual" a "ingesta real". Bancos como Bancolombia, Davivienda, Nu, etc., exportan CSV con columnas distintas y formatos sueltos. El mapping inteligente debe deducir las columnas.

Por hacer:

1. **Página `/importar`** (nueva ruta dentro de `(app)`):
   - Drop zone para CSV con drag & drop.
   - Select de cuenta destino + currency override (default = currency de la cuenta).
2. **Parser CSV con papaparse** (ya en deps):
   - `parseCsv(file): Promise<{ headers, rows }>` con detección de delimiter (auto-detect).
   - Preview de las primeras 10 filas + selector de "fila de encabezado" (algunos extractos tienen 5-10 filas de metadatos arriba).
3. **Inferencia de columnas** — heurística simple por nombre/patrón:
   - `date | fecha | día`     → date
   - `amount | monto | valor` → amount (detectar signo)
   - `description | detalle | concepto` → description
   - `merchant | establecimiento` → merchant
   - El usuario puede sobrescribir cada mapping con un Select.
4. **Job de ingesta** con Trigger.dev (nueva dep) o procesarlo inline si <1000 filas:
   - Step 8a (decidir según tamaño del archivo). MVP simple: procesarlo inline en Server Action con progress en pantalla (TanStack Query polling el batch status).
   - Crear `import_batch` con status=pending, luego processing.
   - Por cada fila: validar, transformar, insertar transacción.
   - Update `import_batch.imported_rows` y errors[].
5. **Tabla `import_batches`** ya está en el schema:
   - Listar imports en `/importar` con su estado (rows, errors).
   - Cada transacción insertada lleva `import_batch_id` para trazabilidad.
6. **Tasas de cambio reales** — pre-requisito para multi-divisa:
   - Endpoint cron `/api/cron/exchange-rates` que llama exchangerate.host y popula `exchange_rates` (date, from, to, rate).
   - `getExchangeRate(from, to, date)` query con fallback al último disponible.
   - `createTransaction` usa esto para calcular `amount_base` correctamente.
   - **Esto desbloquea cross-currency transfers** también.
7. **Cmd+K acción**: "Importar CSV" → navega a `/importar`.

Antes de Step 8: **commit Step 7**. Sugerido:

```
feat(categorias-y-presupuestos): crud categorías custom + presupuestos con progreso
```

Por hacer:

1. **CRUD de categorías propias del usuario** (`user_id NOT NULL`):
   - Modal "Nueva categoría" con name, kind, parent (optional, solo si kind matchea), icon (del set curado), color (paleta muted).
   - Server actions: `createCategory`, `updateCategory`, `archiveCategory`.
   - Página /categorias: mostrar las sistema (read-only badge) + las del usuario (editables/archivables). Filtros por kind (income/expense/transfer).
   - Validación: si se archiva una categoría que tiene transacciones, ofrecer mover a otra antes de archivar.
2. **CRUD de presupuestos** (tabla `budgets`):
   - Modal "Nuevo presupuesto" con category, amount, period (monthly/weekly/yearly), start_date, rollover bool.
   - Server actions: `createBudget`, `updateBudget`, `archiveBudget`.
   - Página /presupuestos: cards por presupuesto con barra de progreso (gasto del período / presupuesto), color tonal según porcentaje (positive/warning/negative del Noir).
3. **Query `getBudgetProgress(userId, period)`** que calcula:
   - Gasto del período actual sumando transactions (kind='expense') de las categorías presupuestadas.
   - Devuelve `{ budgetId, categoryId, budgetAmount, spent, remaining, percent, status }`.
4. **Mostrar progreso en dashboard**: si hay presupuestos activos, una sección "Presupuestos del mes" con barras compactas. Si están todos en verde, copy editorial breve.
5. **Cmd+K acciones**: "Nueva categoría", "Nuevo presupuesto".

Antes de Step 7: **commit Step 6**.

Sugerido:

```
feat(money): crud cuentas + transacciones manual con multi-divisa
```

Es el primer step donde la app produce datos reales del usuario. Cuidado especial con el manejo de dinero (mandato regla 4 y 5).

Por hacer:

1. **Modal "Nueva cuenta"** disparable desde la página Cuentas (botón header) y desde Cmd+K.
   - Formulario: nombre, tipo (`account_type` enum), moneda (COP/USD/EUR/MXN inicialmente), saldo inicial, opcional crédito límite/statement_day/payment_day si type=credit_card, color, icon (del set curado).
   - Validación Zod, Server Action `createAccount`.
2. **Lista de cuentas** en `(app)/cuentas/page.tsx`:
   - RSC query con Drizzle. Card por cuenta con: nombre, tipo, saldo computado (suma de transactions.amount_base WHERE account_id), saldo en moneda original.
   - Estados loading/empty/error.
   - Click → drawer con detalle + movimientos recientes.
3. **Modal "Nueva transacción"** disparable desde Transacciones, dashboard, Cmd+K.
   - Formulario: tipo (income/expense/transfer), cuenta origen, cuenta destino (si transfer), monto, moneda, fecha, descripción, categoría, notes.
   - Calcular `amount_base` con la tasa del día (mock tasa 1:1 hasta step de exchange rates).
   - Server Action `createTransaction`. Por ahora sin embedding (Step 9).
4. **Lista de transacciones** en `(app)/transacciones/page.tsx`:
   - Tabla simple con date, descripción, categoría, cuenta, monto (color por kind).
   - Filtros básicos (kind, cuenta, rango de fecha) via `nuqs` (search params).
5. **Componentes UI base** que faltan:
   - `Button` (shadcn-style pero Noir).
   - `Input`, `Select`, `Textarea`.
   - `Dialog` wrapper sobre radix.
   - `Amount` que recibe `{ value, currency }` y formatea con Dinero.js.
6. **Helpers en `src/lib/currency/`**:
   - `format.ts` — formato según locale del usuario.
   - `dinero.ts` — wrapper de Dinero.js para conversión amount ↔ cents.

Notas:
- Dinero ya está en deps (`dinero.js@2.0.2`).
- Tasas de cambio reales son Step 8 (cron exchange_rates). Hasta entonces, `amount_base = amount_original` cuando `currency === baseCurrency`, sino mock 1:1 con warning.
- Subscripciones de Server Actions: cada uno revalidatePath de la página afectada.

**Antes de empezar Step 6: commit Step 5.** Sugerido:

```
feat(shell): rail + topbar + cmdk + view transitions
```

Por hacer:

1. **Rail lateral 56px** en `src/app/(app)/layout.tsx`:
   - Items: Resumen, Cuentas, Transacciones, Categorías, Presupuestos, Metas, Insights. Footer: Settings + UserButton.
   - Active state: fill sutil con `--surface-hover` + border-left de 2px en `--text`. Sin color saturado.
   - Tooltip lucide a la derecha al hacer hover (delay 500ms).
   - Componente `src/components/app/rail.tsx`.
2. **Topbar 56px** con breadcrumb + Cmd+K trigger ghost button "Buscar… ⌘K".
3. **Cmd+K (Command palette)** en `src/components/app/command.tsx`:
   - cmdk lib (ya en deps).
   - Acciones: navegar a páginas, agregar transacción, agregar cuenta, abrir copiloto.
   - Pinta IA section con `--accent-ai` (única excepción al mandato de cero color).
   - Modal 640px, border-radius `--radius-modal`, blur muy sutil del backdrop (NO glow).
4. **View Transitions API** activadas en `(app)/*`:
   - `viewTransition: true` ya está en next.config (experimento activado).
   - `<Link>` con `unstable_viewTransition` o el patrón moderno.
   - `view-transition-name` en elementos clave del rail (el item activo).
5. **Sidebar collapse-by-shortcut** (`Cmd+\`)? Opcional. Por ahora rail fijo 56px.
6. **Layout grid base**: `grid grid-cols-[56px_1fr]` con topbar arriba.

Antes de empezar Step 5: **commit Step 4**.

Sugerido:

```
feat(design): noir design system — tokens, fonts, motion, icons
```

---

(Step 4 task list para referencia, ya completado:)

- Inter + Inter Display + Fraunces cargadas
- globals.css con hex Noir
- tokens.ts TS
- motion/ con easings, durations, variants
- icons.ts curada
- clerkAppearance con CSS vars
- dashboard placeholder con display + editorial + amount

El shadcn por default está cableado en `globals.css` con grises neutros oklch, pero no es Noir todavía. Hay que reescribir tokens, cargar fuentes y refinar al mandato estético.

Por hacer:

1. **Fuentes** (`src/app/layout.tsx`):
   - Inter (sans + display) — ya tenemos `Geist` que va decente, pero blueprint pide **Inter** + **Inter Display**. Reemplazar.
   - **Geist Mono** — ya está. Mantener.
   - **Fraunces italic** — solo para empty states y onboarding. Cargar con `subsets: ['latin']` + `style: ['italic']`.
   - Variables CSS: `--font-sans`, `--font-display`, `--font-mono`, `--font-editorial`.
2. **Tokens en `globals.css`** (Tailwind v4):
   - Reemplazar todas las oklch genéricas por los valores Noir del blueprint (hex):
     - dark: `bg #0A0A0B`, `surface #141416`, `surface-elevated #1C1C1F`, `surface-hover #222226`, `border #26262A`, `border-emphasis #34343A`, `text #FAFAFA`, `text-secondary #A1A1A8`, `text-tertiary #6B6B72`, `accent-ai #B8A6F5`, `positive #7FB89F`, `negative #D4938A`, `warning #D4B58A`.
     - light: análogos del blueprint.
   - Definir `--radius` base = `0.5rem` (8px). Variantes: chip 4, button/input 8, card 12, modal 16, avatar 999.
   - `font-variant-numeric: tabular-nums` global para `.tabular` y para todo dentro de `.amount`.
3. **`src/lib/design/tokens.ts`** — exportar constantes para TS (colores, easings, durations) sin duplicar lo que ya está en CSS.
4. **`src/lib/motion/`**:
   - `easings.ts` con `smooth = [0.32, 0.72, 0, 1]`.
   - `durations.ts` con `{ instant: 120, fast: 220, base: 320, slow: 480, ambient: 800 }`.
   - `variants.ts` con presets para Motion (fade, slide, scale) que respeten `prefers-reduced-motion`.
5. **`src/lib/design/icons.ts`** — lista curada de iconos lucide que se permiten usar en la app (evita el zoo). Para Step 4 basta con un set inicial (~40 íconos del rail + form fields).
6. **Refinar `clerkAppearance`** para que use las CSS vars en vez de hex hardcoded (sin que rompa el SSR).
7. **`/dashboard` placeholder mejorado** que use las nuevas tipografías para validar visualmente que Inter Display y Fraunces cargan.

Si quieres `view transitions` activadas para `(app)/*` (regla 11), eso entra en Step 5 cuando hagamos el shell con rail. No en este step.

**Antes de empezar Step 4: commit del Step 3.** Sugerido:

```
feat(auth): wire clerk + third-party auth supabase

- proxy.ts con clerkMiddleware protegiendo (app)/*
- ClerkProvider con appearance Noir + localización es-ES
- webhook svix con guard si CLERK_WEBHOOK_SECRET ausente
- getCurrentUser() cacheado con lazy upsert
- env.ts relaja vars no requeridas en step 3 con preprocess para strings vacías
```

---

## Decisiones tomadas (no las re-discutas sin razón nueva)

| Decisión | Por qué |
|---|---|
| **Next 16.2.6** en vez de Next 15 | Es lo que instala `create-next-app@latest`. APIs RSC/Server Actions/`experimental.viewTransition` son idénticas. |
| Proyecto en raíz `/finanzia-app` (no en subcarpeta) | El directorio ya estaba bautizado. Mover el blueprint a `docs/` lo dejó limpio. |
| **Repo en GitHub: `tridentcol/Finanzia-app`** (antes `Eztadia-app`) | El usuario renombró el repo el 2026-05-25 para que coincida con el producto. Remote git local actualizado. Proyecto Supabase también renombrado, pero el `project_ref` sigue siendo `anyinryjupznpouaxhtp` (es inmutable). |
| `pnpm-workspace.yaml` con `allowBuilds: sharp, unrs-resolver, @clerk/shared, esbuild, msw` | pnpm 11 bloquea postinstalls por seguridad. Necesario aprobar uno por uno. |
| **shadcn 4.8.0 como runtime dep** | Patrón v4 de shadcn — la CLI vive en el proyecto. Si se moviera a devDeps, `pnpm shadcn add ...` deja de funcionar. |
| `current_balance` NO existe como columna en `accounts` | Blueprint sugería view o trigger. Lo computamos en query a partir de transactions para evitar desincronización. |
| **55 categorías sembradas** (PROGRESS anterior decía 49) | El seed real tiene 23 padres + 32 hijos. Pasa la validación >40. Si el usuario quiere un set distinto, pedir. |
| Paleta de categorías = 8 swatches muted **sin** `accent-ai` | `accent-ai` (#B8A6F5) está reservado a presencia de IA según mandato estético. |
| Índices en `transactions` SIN cláusula `WHERE deleted_at IS NULL` | La API `index().where(...)` de Drizzle 0.45 en `pgTable` callback no resolvía limpio. Índices globales funcionan igual con soft delete. |
| `db:push` y `db:bootstrap` separados en `package.json` | Permite revisar el diff antes de aplicar. Flujo: `db:push` → `db:bootstrap` → `db:seed`. |
| Blueprint en `docs/finanzia-blueprint.md` | Fuente de verdad. Si CLAUDE.md y blueprint contradicen, blueprint gana. |
| **DB aplicada vía MCP de Supabase, no `pnpm db:push`** | El usuario no tenía aún las connection strings con password en `.env.local`. El MCP las aplica sin exponer credenciales. El resultado en DB es idéntico. |
| `exchange_rates` con RLS habilitada + policy `SELECT USING (true)` | El comentario original decía "queda sin RLS (cache global)". Sin RLS el linter de Supabase tira ERROR porque está expuesta a PostgREST. Solución: RLS ON, SELECT abierto, writes solo desde service_role. Resultado funcional idéntico. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` = legacy anon JWT (no la `sb_publishable_*`) | La integración Clerk-Supabase tradicional usa `auth.jwt() ->> 'sub'` en RLS. Ese flujo está validado con el legacy JWT-based anon key. Migrar a `sb_publishable_*` requeriría re-validar el JWT template. Pendiente. |
| **Vector extension queda en schema `public`** | Mover a `extensions` schema rompería la columna `vector(1536)` y el índice HNSW (search_path). El linter lo marca como WARN, no ERROR. Acepto el warning. |
| **Webhook Clerk en runtime `nodejs`** (no edge) | `svix` y `drizzle-orm/postgres-js` requieren Node APIs. Fluid Compute corre Node sin problema. |
| **Tipo `Appearance` vía `ComponentProps`**, no import directo | `@clerk/types` no está instalado como top-level y `@clerk/shared/types` no re-exporta el alias `Appearance`. `NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>` es robusto. |
| **Botón primario Noir = fill blanco con texto negro** (no `accent-ai`) | `accent-ai` está reservado a presencia de IA. Estilo Linear/Mercury para CTAs no-IA. Aplicado en `clerk-appearance.ts` (`colorPrimary: #FAFAFA`). |
| **Lazy upsert de `users` en `getCurrentUser()`** además del webhook | Defensa contra el race: si el webhook aún no llegó cuando el usuario abre `/dashboard`, hacemos `onConflictDoUpdate` con datos de `currentUser()`. Si el webhook llega después, encuentra fila y la actualiza igual. |
| **Helper `requireCurrentUser()`** además de `getCurrentUser()` | RSCs en `(app)/*` saben que el middleware ya garantizó auth — pueden usar el variant que tira en vez de manejar `null`. Reduce ruido en cada page. |
| **Usar `<Show when="signed-in/out">` en lugar de `<SignedIn>`/`<SignedOut>`** | Patrón oficial Clerk v7. Reemplaza a los componentes deprecados; funciona server-side. Aplicado en `app/page.tsx` con `<SignInButton mode="modal">`, `<SignUpButton mode="modal">`, `<UserButton>`. |
| **`@clerk/localizations` con `esES`** | UI de Clerk en español. El paquete pesa ~150KB tree-shakable, vale la pena por consistencia editorial. |
| **`env.ts` aflojado**: AI / Upstash / Trigger / `CLERK_WEBHOOK_SECRET` ahora son `.optional()` | Para arrancar `pnpm dev` durante Step 3 sin tener todas las claves listas. El webhook handler ahora hace guard: si `CLERK_WEBHOOK_SECRET` falta, devuelve 503. Cuando los steps que las consumen lleguen, el código que dependa de cada var debe hacer su propio guard. |
| **Cmd+K state vive en Zustand, no Context** (`src/components/app/command-store.ts`) | El trigger del Topbar y el CommandPalette montado en el layout están en árboles separados. Zustand evita pasar props o crear un Context. Costo: 1 nueva dependencia ya en deps. |
| **`<ViewTransition>` desde `react`** + `experimental.viewTransition: true` | Patrón oficial Next 16. Requiere triple-slash reference a `react/canary` en `src/types/react-experimental.d.ts` para que TS reconozca el export. Animations duration y easing aplicadas globalmente vía `::view-transition-*` en `globals.css`. |
| **Páginas placeholder con `EmptyState` editorial** | Regla 14 del mandato: empty states son una oportunidad, no un bug. Fraunces italic en el headline, body Inter, sin ilustración. |
| **Cmd+K acción IA "Preguntar a Finanzia"** disabled con `próximamente` | Mostrar la ranura desde el inicio comunica intención del producto. Activar en Step 11 (copiloto). El icono usa `accent-ai` — única excepción al cero-color en este step. |
| **`amount_base = amount_original` mock 1:1 hasta Step 8** | Multi-divisa real requiere tasas en `exchange_rates` y el cron de fetch. Por ahora si la moneda de la tx coincide con `baseCurrency` (default COP), el cálculo es exacto. Si no, el saldo agregado del dashboard será incorrecto para cuentas no-base — documentado en código (`transacciones/actions.ts` línea ~127) y se arregla en Step 8. |
| **Transferencias cross-currency bloqueadas** en Step 6 | `createTransaction` rechaza transfers entre cuentas de monedas distintas. Implementar conversión correcta requiere dos asientos espejo (uno en cada moneda) o un mecanismo de doble entrada. Decisión: posponer hasta tener tasas reales (Step 8). |
| **Saldo computado vía CTE SQL crudo en `listAccountsWithBalance`** | Drizzle no expone bien CTEs/UNION; `db.execute(sql\`...\`)` es más limpio que ensamblar tres subqueries. El saldo se computa al render — no se almacena en la tabla `accounts` (decisión previa, evita drift). |
| **UI base Noir hecha a mano, no `shadcn add`** | El componente que vino del bootstrap (`button.tsx`) usaba tokens shadcn defaults; los reescribí siguiendo el mandato. Los demás (Input, Select, Dialog, Field, etc.) son nuevos. Si en el futuro usamos shadcn CLI, el target será sobreescribir, no añadir paralelo. |
| **Dialogs globales gestionados por Zustand store** (`dialog-store.ts`) | Patrón uniforme: cada dialog tiene un `id`, el store guarda `active: id | null`, los triggers dispatchan `open(id)`. Permite que Cmd+K y botones de header compartan el control sin prop drilling ni context. |
| **`(app)/layout.tsx` fetchea accounts + categories para los dialogs** | Los modales necesitan estos datos para los selects. Como el layout envuelve todo el grupo, está disponible en cualquier ruta. `revalidatePath` después de crear/archivar invalida el layout automáticamente. |
| **Presupuestos solo sobre `kind='expense'`** | Topes en ingresos o transfers no tienen semántica obvia. Si hace falta, lo extendemos. La validación está en `createBudget` y en el filter del modal. |
| **Period range vía `date_trunc` de Postgres** (no JS) | El cálculo del rango del período actual lo hace SQL: `date_trunc('week', CURRENT_DATE)` retorna el lunes ISO. Menos código JS, sin issues de timezone (todo se evalúa en server, en la TZ del Supabase project). Cuando el usuario tenga TZ propia (regla blueprint), se ajustará pasando un anchor explícito. |
| **Presupuestos no agregan transacciones de subcategorías** | Un presupuesto sobre "Transporte" no suma "Combustible" automáticamente — el `category_id` se compara exacto. Si el usuario quiere agregado, debe poner el presupuesto en cada hijo o crear una categoría plana. Documentado en `listBudgetsWithProgress`. |
| **Solo 1 nivel de jerarquía en categorías** | `createCategory` rechaza `parentId` si el parent ya tiene `parentId !== null`. Mantiene la UI predecible y evita árboles arbitrarios. Si se necesita profundidad, lo revisamos. |
| **Icon picker curado (16 iconos) vs lista completa (~85)** | Para el modal de Nueva categoría limitamos a un subset visualmente coherente. La lista completa sigue disponible vía `icons` import para componentes que requieren más. |
| **Paleta muted en `src/lib/design/palette.ts`** separada de `tokens.ts` | `tokens.ts` es para el sistema (bg, text, etc.). `palette.ts` es para colores que el usuario asigna (categorías, futuras tags). Separación semántica. |
| **Item "Importar" en el rail (no escondido en Cmd+K)** | Aunque conceptualmente es una "acción", la importación es una operación frecuente y discoverable. Tener un slot visual junto a Transacciones lo hace obvio. Se mantiene también el atajo en Cmd+K para flujos de teclado. |
| **Imports cap a 5000 filas por batch** en `runImport` | Defensa contra extractos enormes que saturen el Server Action. Si en el futuro un usuario tiene más, decidiremos entre Trigger.dev jobs o chunking client-side. |
| **Subir env vars a Vercel vía CLI** (no dashboard manual) | `vercel env add NAME ENV --value VALUE --yes --force` con un loop sobre `.env.local`. Para preview hay que pasar `""` como tercer arg (gitbranch), si no el CLI exige una branch específica en non-interactive mode. Patrón anotado en gotchas. |
| **Provider de tasas = `open.er-api.com`** (sin API key) | Free tier sin registro, refresh diario, base USD. `exchangerate.host` ahora requiere key y `frankfurter.app` no incluye COP. Si en el futuro se carga `EXCHANGE_RATE_API_KEY`, swappear sólo `fetchDailyRates` en `rates.ts`. |
| **Cross-currency transfers = dos asientos espejo con `transfer_group_id`** | Schema añadido: columna `transfer_group_id uuid` nullable. Origen lleva `kind=transfer + transfer_account_id=destino` (CTE le resta). Destino lleva `kind=transfer + transfer_account_id=NULL + transfer_group_id=mismo` (CTE le suma). Each fila aporta amount_original en su propia moneda → balance funciona. Same-currency single-row sigue funcionando (`transfer_group_id IS NULL` → fan-out UNION normal). Trade-off: el listing muestra dos filas separadas en cross-currency (no se foldean). Mejorarlo en una pasada futura. |
| **`vercel.json` minimalista** (solo `crons`) | El bug que causó "Vercel descargaba binario" fue env vars vacías, no `vercel.json`. Re-añadirlo SÓLO con `crons` evita el problema previo (headers que conflictuaban con next.config) y deja Vercel autodetectar Next.js + pnpm. Para futuras options preferir `vercel.ts` con `@vercel/config` (recomendado por Vercel) cuando la dep esté estable. |
| **`getTotalBalanceInBase` compone `listAccountsWithBalance` + `convertAmount`** | SQL puro era frágil con `initial_balance` en moneda nativa de cada cuenta. La nueva versión llama al list, luego itera convirtiendo cada saldo. Retorna `{ total, partial }` — `partial=true` si alguna cuenta cayó al fallback 1:1. UI muestra "conversión parcial" en el caption del saldo total. |
| **OpenAI sólo para embeddings, Anthropic para generación** | `text-embedding-3-small` (1536 dim) matchea el schema (`vector(1536)` + HNSW cosine) y es 5x más barato que ada-002 obsoleto. La generación (categorización fallback, copiloto futuro) usa Claude Sonnet 4.6 por calidad de razonamiento en español. División clara evita confusión y permite cambiar provider por dominio. |
| **kNN sólo dentro del mismo `kind`** | Si una tx es expense, sus vecinos en pgvector deben ser TAMBIÉN expense — categorías cross-kind no aplican y meten ruido. Filtro doble: `t.kind = $kind` (transacciones a buscar) Y `c.kind = $kind` (categorías a votar). Para `transfer` retornamos null sin tocar IA: las transferencias no se categorizan. |
| **`categorizeBatch` para imports = embedMany SIN LLM fallback** | Importar 5000 rows con LLM costaría minutos y dinero. Diseño: 1 round-trip a `embedMany`, luego kNN local por row. Si el bucket no alcanza umbral, el row queda sin categoría (NO va al LLM). El usuario corre `Categorizar N con IA` después y ese flow sí puede usar LLM por chunks. |
| **CategoryCell editable inline con Radix Select** | Patrón Linear / Notion: la celda ES el control. Click → dropdown. Sin modales para algo tan común. Cuando el usuario cambia, `user_corrected = true` y `ai_categorized = false` — la señal sirve para futuras predicciones (kNN aprende del corrected). |
| **Sentinel `__unset__` para "sin categoría" en Select** | Radix Select rechaza `value=""` (lo trata como uncontrolled). Sentinel string convertido a `null` en el onChange. Patrón replicable. |
| **`embedding` persistido aunque la categoría quede null** | Si el usuario crea una tx sin categoría y la IA no llega a confianza, guardamos el embedding igual. Cuando él la categorice manualmente o cuando haya más historia, esa fila contribuye como vecino kNN sin re-embeddear. |
| **Dedupe de insights via `data.signature`** | El cron puede correr varias veces al día (operador, reintento). Cada detector emite una `signature` determinista (ej. `anomaly:<categoryId>:<weekStart>`). El runner consulta insights del usuario en ventana de 24h y skipea si la signature ya existe. Permite re-correr sin spammear al usuario y mantiene `data.signature` consultable a futuro (e.g., generar un cliente que clasifique notificaciones). |
| **Detectores son SQL puro, LLM SOLO en `recommendation`** | Reduce costo y latencia. Las anomalías, tendencias y forecasts son determinísticas y reproducibles — el LLM aporta cuando hace falta razonamiento sobre el snapshot agregado del usuario. Si se cae el provider AI, solo `recommendation` deja de funcionar; el resto sigue. |
| **Recommendation no ve transacciones individuales** | Le pasamos solo agregados (totales mensuales por kind, top categorías expense, status de presupuestos) — JSON estructurado. Minimiza tokens (~500 prompt en typical case) y evita leak de descripciones sensibles. La salida es Zod-validada vía `generateObject` (no parseo manual de JSON). |
| **InsightCard con asChild en Button para Link** | El "Abrir" del card usa `<Button asChild variant="outline">` envolviendo un `<Link>` — patrón shadcn/Radix `Slot`. Mantiene el styling Noir del Button y deja Next manejar la navegación con prefetch. El onClick del Link dispara `markInsightActed` antes de navegar. |
| **Tools del copiloto = closures sobre `CopilotContext`** | Cada tool factory recibe `{ userId, baseCurrency }` y devuelve el `tool()` con su execute scoped. Esto IMPIDE que el LLM use otro userId (no aparece en el inputSchema) — defensa en profundidad sobre la verificación RLS. Patrón replicable cuando sumemos más tools. |
| **Propose-tools NO ejecutan** (regla 6) | `proposeCreateTransaction` y `proposeSetBudget` validan que la cuenta/categoría existe y son del usuario, pero devuelven un objeto JSON. La UI muestra `ProposalCard` con botón Confirmar que llama el server action real (`confirmProposedTransaction` delega en el `createTransaction` ya escrito, sin duplicar lógica). |
| **Persistencia por turno, no por mensaje** | `conversations` se crea en el primer turno (`id` se devuelve por header `x-conversation-id`). `messages` se inserta 2 veces por turno: el último user message ANTES del LLM, y el assistant message COMPLETO dentro del `onFinish`. Esto evita guardar deltas parciales del streaming. |
| **`useChat` v6 + `DefaultChatTransport`** | La API cambió en `@ai-sdk/react@3.x`. En vez de `useChat({ api: '/api/...' })` ahora es `useChat({ transport: new DefaultChatTransport({ api: '/api/...' }) })`. `messages` son `UIMessage[]` con `parts: Array<TextPart | ToolPart | ...>`. Cada tool-part tiene `state: 'input-streaming' \| 'input-available' \| 'output-available' \| 'output-error'`. |

---

## Gotchas conocidos (evita volver a tropezar)

- **pnpm 11 + postinstall scripts**: cualquier dep nueva con script puede agregar `set this to true or false` al `pnpm-workspace.yaml`. Editar a `true` explícito.
- **drizzle-kit** lee `.env.local` SOLO porque `drizzle.config.ts` lo carga con `dotenv` manualmente. No confiar en autodetección.
- **postgres-js + Supabase pooler**: `prepare: false` es obligatorio para el transaction pooler (puerto 6543). Sin eso, los prepared statements pelean con el pooler.
- **`vector` columna**: requiere `CREATE EXTENSION vector;` ANTES de aplicar la migración. El orden en `extensions.sql` → migración es importante.
- **`server-only`** está importado en `src/lib/db/client.ts` y `src/lib/auth.ts` para que un import accidental desde un client component reviente el build.
- **RLS con `auth.jwt() ->> 'sub'`**: solo funciona si la conexión Postgres lleva un JWT válido (integración Clerk-Supabase). Drizzle con `postgres` role bypassea RLS — es defensa en profundidad, no protección primaria. La protección primaria es el filtro `user_id = currentUser.id` en cada query.
- **MCP de Supabase no expone secretos**: `get_publishable_keys` da anon y publishable; NO da service_role ni connection strings con password. El usuario debe copiar manualmente `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL` y `DIRECT_URL` desde el dashboard.
- **`exchange_rates` RLS**: SELECT abierto para anon/auth, INSERT/UPDATE/DELETE solo via service_role (Drizzle server-side). Si en algún momento se requiere que el cliente escriba a esta tabla, romperá silenciosamente.
- **Linter de Supabase**: correr `mcp__supabase__get_advisors` después de cualquier DDL. El ERROR de RLS_DISABLED_IN_PUBLIC es bloqueante; los WARN como `extension_in_public` se pueden aceptar con justificación.
- **Clerk v7 deprecó `<SignedIn>`/`<SignedOut>`**: el reemplazo es `<Show when="signed-in">` / `<Show when="signed-out">`, que funciona en server components. Para state imperativo en RSC también está `await auth()`. Para client components, `useUser`/`useAuth`.
- **Middleware se llama `proxy.ts` en Next.js ≥16** (no `middleware.ts`). El código de `clerkMiddleware()` es idéntico, solo cambia el nombre del archivo. Ubicar en `src/` si hay `src/` directory, sino en la raíz. Matcher debe incluir `'/__clerk/(.*)'` para el auto-proxy de Clerk.
- **Renombrar un proyecto Supabase NO cambia el `project_ref`**: solo cambia el display name en el dashboard. El ref (slug en URLs y connection strings) queda fijo de por vida. Por eso `.mcp.json` y `.env.local` no necesitan tocarse tras un rename.
- **Clerk `secret key` format**: empieza con `sk_test_` (dev) o `sk_live_` (prod), seguido de ~40 chars base64. Si pegas algo como `k_test_…` (sin `s`), Zod no lo detecta (es string no vacío) pero todos los requests a Clerk fallan con 401. Validar visualmente al pegar.
- **Pooler host de Supabase varía por región Y por número de cluster**: el formato es `aws-N-<region>.pooler.supabase.com`. Para este proyecto: `aws-1-us-west-2.pooler.supabase.com`. Si la región está mal, devuelve "Tenant or user not found" (no es error de password). Si el N (`aws-0` vs `aws-1`) está mal, devuelve "(ENOTFOUND) tenant/user not found". La forma fiable de obtener la string: copiarla directo del dashboard de Supabase → Settings → Database → Connection string.
- **Vars opcionales en `.env.local` con valor vacío (`FOO=`) requieren preprocess**: Zod `.optional()` solo ignora `undefined`, no `""`. Helper `optionalString()` en `env.ts` convierte `""` a `undefined` antes de validar.
- **Build de Vercel falla si env vars faltan al primer deploy**: `env.ts` arrojaba al import. Fix aplicado (commit `e733e0e`): `env.ts` detecta `NEXT_PHASE === 'phase-production-build'` o `SKIP_ENV_VALIDATION=1` y NO arroja durante el build. En runtime sigue estricto. Esto permite que el primer deploy pase aunque las env vars no estén configuradas todavía. Tras pegarlas en Vercel, redeploy y la app funciona normal.
- **Vercel servía `finanzia-app-six.vercel` (archivo descargable) en vez de la página**: causa REAL (confirmada en logs de runtime) — las env vars no estaban configuradas en Vercel, así que el middleware Clerk crasheaba con `Missing publishableKey`. La respuesta 500 venía con body `"Internal Server Error"` plano y sin `Content-Type`; combinado con `X-Content-Type-Options: nosniff` (que dejamos en `next.config.ts`), Chrome no podía sniffearlo y lo trataba como `application/octet-stream`, descargándolo con nombre basado en el host (`finanzia-app-six.vercel`). Quitar `vercel.json` ayudó (lo hicimos antes) pero NO era la causa raíz. Fix definitivo: subir las 14 env vars de `.env.local` a Vercel Production + Preview con `vercel env add NAME ENV --value VALUE --yes --force`. Para Preview pasar `""` como tercer arg (gitbranch) — sin él el CLI exige una branch específica en non-interactive mode.
- **`vercel env add NAME preview` falla en non-interactive con `git_branch_required`**: en modo agent (auto-detected) el CLI exige saber a qué git branch del preview. Trabajar alrededor pasando `""` explícito: `vercel env add VAR preview "" --value VAL --yes --force` → aplica a todas las preview branches. Si pasas un nombre de branch (ej. `main`) falla con `Cannot set Production Branch "main" for a Preview Environment Variable`.
- **`postgres-js` devuelve columnas `date` (sin time) como `string` `'YYYY-MM-DD'`, NO como `Date`**: solo `timestamptz` se parsea a `Date`. Si tipas mal y haces `row.someDate.toISOString()`, falla en runtime con "toISOString is not a function". Aplicar siempre `period_start: string` al typing de `db.execute<T>(...)` cuando la columna sea `::date` o `date`. (Bug encontrado en `listBudgetsWithProgress` durante Step 7.)
- **`revalidatePath('/foo')` no invalida los layouts ancestros**: solo invalida la page de `/foo`. El `(app)/layout` que fetchea accounts + categories para los selects de los dialogs queda con cache viejo. Solución aplicada: después de un mutación exitosa, llamar `router.refresh()` desde el cliente — fuerza re-fetch de TODOS los RSCs de la ruta actual incluyendo el layout. Patrón unificado en los 4 dialogs (`new-{account,transaction,category,budget}-dialog.tsx`). Alternativa más agresiva: `revalidatePath('/', 'layout')` en cada server action, pero invalida también marketing innecesariamente.
- **Clerk URLs por env var**: `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `*_FALLBACK_REDIRECT_URL`. Ya están en `.env.local`. Si cambian, también hay que tocarlos en el dashboard de Clerk (Paths) para que coincidan.
- **Vercel Cron auth**: Vercel Cron sólo invoca con GET y agrega `Authorization: Bearer ${CRON_SECRET}` SI la env var `CRON_SECRET` existe en el project (ya está). El handler valida y devuelve 401 si no coincide. Para invocar manualmente desde dev: `curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/exchange-rates`.
- **pgvector kNN parameter binding**: el operador `<=>` requiere el vector como literal `'[a,b,c]'::vector`, NO como array de drizzle/postgres-js. Helper `toPgvectorLiteral(vec)` convierte. Si pasas el array directo, postgres rechaza con "could not determine data type of parameter $N". El cast `::vector` después del literal es obligatorio.
- **AI SDK `embed`/`embedMany` API**: en `@ai-sdk/openai@3.x` el modelo se obtiene con `provider.textEmbedding('text-embedding-3-small')`, NO `provider.embedding(...)` (legacy). Retorna `{ embedding }` o `{ embeddings }` arrays de `number[]`. Si el provider no tiene API key, throw — por eso el cliente está en lazy guard y se devuelve `null` cuando falta.
- **Drizzle `inArray` con enums**: la sobrecarga estricta de `inArray(column, values)` exige que el array literal coincida con el tipo del enum, NO `string[]`. Si pasas un `as const` con cast a `string[]`, falla con "Type 'string' is not assignable to type". Solución: pasar directamente el array literal `['unread', 'read', 'acted']` — TypeScript narrowea al tipo enum automáticamente. Bug encontrado en `listInsightsForUser` durante Step 10.
- **Cron stacking en `vercel.json`**: cada cron entry corre independientemente. Si dos crons usan `0 X * * *` cercanos (ej. `0 5` y `0 6`), Vercel los serializa por proyecto, no en paralelo, así que no hay problema de race. Pero asegurate de que cada cron NO dependa del output del otro — son idempotentes.
- **`convertToModelMessages` v6 es async**: en `ai@6.x` (a diferencia de v5) `convertToModelMessages(uiMessages)` devuelve `Promise<ModelMessage[]>`. Si lo pasas directo a `streamText({ messages })`, TS rompe con "Promise missing length/push". Solución: `await convertToModelMessages(...)` antes de pasarlo. La función que llama a `runCopilotChat` debe ser async.
- **Tipo de `onFinish` de `streamText` se queja con tools estrictos**: cuando los tools tienen el shape literal (no `ToolSet` genérico), el tipo de `onFinish` se vuelve narrowizado y el caller genérico no encaja. Solución pragmática: tipar el handler como `(event: any) => void | Promise<void>` en la API pública del wrapper. Encapsulado, no es noise. 
- **`open.er-api.com` rate limits**: free tier sin key, ~1500 req/mes según docs. Diario × 30 = 30 reqs/mes; sobra. Si el cron se vuelve loco (loops humanos manuales), upsert es idempotente — no hay daño. La respuesta es base USD; los pairs from→to se derivan dividiendo (USD→to)/(USD→from).
- **Cross-currency transfer listing**: las dos filas espejo aparecen como dos rows separados en `/transacciones` y `/dashboard recent`. El origen muestra "src → dst" (tiene `transferAccountId`); el destino se renderiza sin flecha (`transferAccountId IS NULL`). Convivible pero perfectible — un fold opcional en el listing es candidato para una pasada futura.
- **`vercel.json` reintroducido**: sólo con `crons`, intencionalmente sin `headers` ni `routes` (esos viven en `next.config.ts`). El bug histórico de "Vercel servía binario" NO fue `vercel.json`; fue env vars vacías. Mantenerlo minimalista evita re-tropezar.

---

## Estado del repo

- Repo remoto: `https://github.com/tridentcol/Finanzia-app` (renombrado desde Eztadia-app)
- Branch: `main`
- Último commit: `ac49982 feat(debts+dashboard): sección de deudas, breakdown de gastos por categoría`
- Push directo a `main` lo hace **el usuario** (classifier bloquea push automatizado en auto-mode). Cada push lanza deploy a producción en Vercel.
- Working tree pendiente de commit:
  - Nuevos: `src/middleware.ts`, `src/lib/auth.ts`, `src/lib/clerk-appearance.ts`, `src/app/(auth)/...`, `src/app/(app)/...`, `src/app/api/webhooks/clerk/route.ts`
  - Modificados: `src/app/layout.tsx`, `src/app/page.tsx`, `package.json`, `pnpm-lock.yaml`, `docs/PROGRESS.md`
  - `.env.local` (ignorado).
  - Recomendado: commit cuando el smoke test del Step 3 pase.

---

## Config / integraciones externas

| Servicio | Estado | Notas |
|---|---|---|
| Supabase project | `anyinryjupznpouaxhtp` (us-west-2) | ✅ schema + RLS + seed aplicados vía MCP. URL: `https://anyinryjupznpouaxhtp.supabase.co`. Pooler host: `aws-1-us-west-2.pooler.supabase.com`. |
| Supabase MCP server | Configurado en `.mcp.json` (project scope) | Conectado |
| Clerk | ⏳ no creado | Código wireado, esperando que el usuario cree la app y pegue claves. JWT template "supabase" pendiente. |
| Anthropic API | ⏳ no provisto | Necesario en Step 9+ |
| OpenAI API | ⏳ no provisto | Solo para embeddings (Step 9) |
| Upstash Redis | ⏳ no creado | Step 8+ (rate limit / cache) |
| Trigger.dev | ⏳ no creado | Step 8 (job de import CSV) |
| Sentry | ⏳ no creado | Step 12 (deploy) |
| Vercel | ✅ desplegado | Proyecto `daniels-projects-8dbbaf4e/finanzia-app`. Alias prod: `finanzia-app-six.vercel.app`. 14 env vars pegadas en Production + Preview. CLI linkeado en `.vercel/`. |

`.env.local` contiene autollenados: `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `CRON_SECRET`, rutas de Clerk. Pendiente de llenar: password DB, service_role, todas las claves de servicios externos.

---

## Cómo actualizar este archivo

Al cerrar un step:
1. Marca el step ✅ en la tabla de arriba.
2. Mueve "Next action" al primer punto concreto del siguiente step.
3. Si tomaste una decisión nueva, agrégala a "Decisiones tomadas" con su `por qué`.
4. Si tropezaste con algo no documentado, agrégalo a "Gotchas".
5. Si se creó/conectó un servicio externo, actualiza "Config / integraciones externas".
6. Cambia la línea "Última actualización" de arriba.
