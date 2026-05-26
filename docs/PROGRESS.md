# Finanzia — Estado del proyecto

> Archivo vivo. **Actualízalo al cerrar cada step o al tomar una decisión que afecte el rumbo.**
> El builder lo lee al inicio de cada sesión para no perder continuidad.
>
> Última actualización: 2026-05-26 — Step 7 ✅. Step 8 wip (helpers + server action listos, falta `/importar/page.tsx`). **Deploy en Vercel rompió** (servía un archivo descargable en vez de la página) — fix aplicado: removido `vercel.json` agresivo y movidos headers a `next.config.ts`. Pendiente: verificar redeploy + cerrar Step 8 + seguir 9-12.

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
| 8 | Import CSV con mapping inteligente | ⚠ wip | Helpers `src/lib/import/{infer-columns,parse-row}.ts` listos. Server action `runImport` en `src/app/(app)/importar/actions.ts` lista (crea `import_batch`, parsea filas, inserta en chunks de 200, actualiza estado del batch). Cliente `importer-client.tsx` con drop zone, mapping UI auto-inferido, preview, headerRow ajustable. Query `listImportBatchesForUser` lista. **FALTA**: el server component `src/app/(app)/importar/page.tsx` que fetcha accounts + batches y monta el cliente, item "Importar CSV" en Cmd+K, y verificar que `papaparse` esté en deps (ya está, ^5.5.3). |
| 9 | Auto-categorización con IA + embeddings | ⏳ pendiente | |
| 10 | Insights engine + cron diario | ⏳ pendiente | |
| 11 | Copiloto Finanzia con tool-calling | ⏳ pendiente | |
| 12 | Metas, recurring, tarjetas, alertas, deploy | ⏳ pendiente | |

---

## Next action

**Antes de tocar código: verificar el redeploy de Vercel.**

1. Abrir el dashboard del proyecto en Vercel → ver el último deployment (debe corresponder al commit `fix(vercel)` que está en `main`).
2. Si el build aún falla:
   - Revisar logs en Vercel.
   - Verificar que todas las env vars de §1 de `docs/DEPLOY.md` estén pegadas como Production + Preview. **Especial**: `NEXT_PUBLIC_APP_URL` debe apuntar al dominio Vercel asignado (no `localhost:3000`).
3. Si el build pasa pero la URL se sigue descargando como archivo: probablemente el caché del browser. Hard refresh + verificar en incógnito.
4. Validar end-to-end igual que `/api/auth-check` hizo en Step 3 (sign-in → /dashboard → ver fila en Supabase).

**Luego: cerrar Step 8 — Import CSV con mapping inteligente.**

Estado wip:
- ✅ `src/lib/import/infer-columns.ts` — heurística regex.
- ✅ `src/lib/import/parse-row.ts` — normaliza fecha (ISO, DD/MM/YYYY), monto (LATAM y EU), kind (signed o split columns).
- ✅ `src/app/(app)/importar/actions.ts` — `runImport` con chunks de 200, crea `import_batches`, atualiza estado.
- ✅ `src/lib/db/queries/imports.ts` — `listImportBatchesForUser`.
- ✅ `src/app/(app)/importar/importer-client.tsx` — drop zone, mapping UI, preview, header row picker.
- ⏳ **`src/app/(app)/importar/page.tsx`** — server component pendiente. Estructura sugerida:
  ```tsx
  import { requireCurrentUser } from '@/lib/auth'
  import { listUserAccountsBasic } from '@/lib/db/queries/transactions'
  import { listImportBatchesForUser } from '@/lib/db/queries/imports'
  import { ImporterClient } from './importer-client'
  // header con título, ImporterClient con accounts, sección "Imports recientes" con batches
  ```
- ⏳ Cmd+K: agregar item "Importar CSV" que navegue a `/importar`.
- ⏳ Smoke test con un CSV real de algún banco.

**Después de Step 8: Step 8b (exchange rates cron) → Step 9 (IA + embeddings) → Step 10 (insights) → Step 11 (copiloto) → Step 12 (metas/recurring/alertas/deploy prod).**

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
- **Vercel servía `finanzia-app-six.vercel` (archivo descargable) en vez de la página**: causa probable — `vercel.json` con `framework`, `installCommand`, `buildCommand` y `regions: pdx1` interfería con la autodetección de Vercel. Fix: removido `vercel.json` completamente, headers movidos a `next.config.ts` con `async headers()`. Vercel ahora autodetecta Next.js + pnpm automáticamente.
- **`postgres-js` devuelve columnas `date` (sin time) como `string` `'YYYY-MM-DD'`, NO como `Date`**: solo `timestamptz` se parsea a `Date`. Si tipas mal y haces `row.someDate.toISOString()`, falla en runtime con "toISOString is not a function". Aplicar siempre `period_start: string` al typing de `db.execute<T>(...)` cuando la columna sea `::date` o `date`. (Bug encontrado en `listBudgetsWithProgress` durante Step 7.)
- **`revalidatePath('/foo')` no invalida los layouts ancestros**: solo invalida la page de `/foo`. El `(app)/layout` que fetchea accounts + categories para los selects de los dialogs queda con cache viejo. Solución aplicada: después de un mutación exitosa, llamar `router.refresh()` desde el cliente — fuerza re-fetch de TODOS los RSCs de la ruta actual incluyendo el layout. Patrón unificado en los 4 dialogs (`new-{account,transaction,category,budget}-dialog.tsx`). Alternativa más agresiva: `revalidatePath('/', 'layout')` en cada server action, pero invalida también marketing innecesariamente.
- **Clerk URLs por env var**: `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, `*_FALLBACK_REDIRECT_URL`. Ya están en `.env.local`. Si cambian, también hay que tocarlos en el dashboard de Clerk (Paths) para que coincidan.

---

## Estado del repo

- Repo remoto: `https://github.com/tridentcol/Eztadia-app`
- Branch: `main`
- Último commit: `chore: bootstrap finanzia repo (steps 1-2)`
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
| Vercel | ⏳ no creado | Step 12 |

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
