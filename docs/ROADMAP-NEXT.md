# Finanzia — Roadmap de Funcionalidades (Siguiente Sprint)

> Documento vivo. Iniciado 2026-05-27 tras cerrar la pasada de performance (Step 16) y la foundation visual de tarjetas (Step 17a, commit `7c212ad`).
>
> Acumula todas las ideas validadas por el usuario + las decisiones tomadas durante la planeación.
>
> Si una fase contradice este archivo después de implementarse, **se actualiza este archivo**, no el código.

---

## Visión

Llevar Finanzia "al siguiente nivel" en funcionalidades sin comprometer:

- **Accesibilidad** (AA mínimo, focus visible, navegación por teclado)
- **Fluidez** (la base de perf del Step 16 se mantiene; navegación cross-route < 300ms)
- **Curva de aprendizaje baja** (features aparecen contextualmente, sin menús cargados)
- **Mandato Estético Noir** intacto (CLAUDE.md regla 13)

---

## Origen de las ideas

Tres ideas validadas por el usuario tras consultar a futuros usuarios:

- **Idea 1**: cierre de caja + recurrentes + gastos hormiga + recomendaciones
- **Idea 2**: enfoques de ahorro personalizados con perfil + survey inicial
- **Idea 3**: analizador de compras con tarjeta en tiempo real (incluye mecánica per-tarjeta)

Tracks adicionales identificados durante el diseño:

- **Sincronización bancaria** (especialmente Bancolombia — el banco más común en Colombia)
- **Identidad visual de tarjetas** (no era idea original; surgió de Idea 3)
- **Onboarding** (Sección 8 del blueprint pendiente desde el MVP)

---

## Decisiones tomadas (no re-discutir sin razón nueva)

| Decisión | Por qué |
|---|---|
| "Cierre de caja" es una **vista diaria** de movimientos, NO un modo de negocio separado | Aclaración del usuario 2026-05-27. Preserva Finanzia como producto unificado de finanzas personales. Sin schema nuevo. |
| Identidad visual de tarjeta: **librería curada + motor de búsqueda fallback (Opción C híbrida)** | Curado garantiza calidad pareja entre cards; auto-search cubre casos atípicos sin ensuciar el dataset principal. |
| Imagen de tarjeta es del banco; **datos del usuario van SEPARADOS abajo**, nunca overlay sobre la imagen | Decisión explícita del usuario. Evita problemas de edición de arte ajeno (IP) y se ve más limpio. |
| Schema de tarjeta: 5 columnas opcionales en `accounts` (`bank_slug`, `card_product_slug`, `card_brand`, `card_last_four`, `card_holder_name`) | Migración `0002_card_visual_identity.sql` aplicada a prod (Supabase MCP). Aplica a credit_card, checking, savings. `kind` (credit/debit) se deriva de `account.type`. |
| Catálogo curado en TS (`src/lib/cards/catalog.ts`), imágenes en `/public/cards/{bankSlug}-{kind}-{productSlug}.avif` | Single source of truth para banco→producto→brand. Naming determinístico. |
| Sync bancaria: **email parsing primero (gratis), Belvo después (premium)** | Email parsing tiene fricción manageable + cero costo per-transacción. Belvo cuesta ~$0.20-0.40 USD por link/mes. |
| Belvo Open Banking permanece **post-MVP visual** (Fase 5b) | Complejidad operativa alta (compliance, re-auth, error handling). No bloquea acercarse a usuarios. |
| Onboarding (Sección 8 blueprint) se integra con la encuesta de ahorro de Fase 1 | Dos problemas, un flujo. |
| Inversiones, cripto, OCR de tickets, voice input, sharing en pareja → **fuera de scope este sprint** | Diluyen el producto. Quedan en v2 post feature-completion. |
| **Orden de fases**: 1→2→3→4→5→6 (propuesto) | Confirmado 2026-05-27. |
| **Onboarding saltable** con advertencia "deshabilita recomendaciones de ahorro" | Menos fricción al primer login. Se completa desde `/ajustes/perfil-financiero`. |
| **Editor de identidad visual para cuentas existentes** (Fase 4a residual): implementar ahora | Gap UX inmediato si hay cuentas sin `bank_slug`. |
| **Fase 5a (email parsing) entra en este sprint**, Fase 5b (Belvo) post-sprint | Email parsing es gratis y cubre Bancolombia. Belvo post-feature-completion. |
| **Catálogo ampliado a 13 bancos**: se agregan Bancoomeva, AV Villas, Itaú Colombia, Nequi | Cobertura ampliada del mercado colombiano. Imágenes pendientes de drop en `/public/cards/`. |

---

## Roadmap — 6 Fases

### Fase 1 — Onboarding + Perfil de Ahorro

**Tamaño**: S/M
**Resuelve**: Sección 8 del blueprint (onboarding) + base de Idea 2

#### Schema

Tabla nueva `savings_plans`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default random() | |
| `user_id` | uuid not null FK users.id cascade | RLS |
| `method` | enum('percentage_income', 'fixed_amount', 'none', 'other') | |
| `params` | jsonb | Ej `percentage_income` → `{ percent: 0.10 }`; `fixed_amount` → `{ amount: "200000", frequency: "monthly" }` |
| `active_from` | date not null | |
| `active_to` | date nullable | null = activo |
| `created_at` | timestamptz default now() | |

Index: `(user_id, active_from desc)` — para resolver el plan activo en una fecha dada.

Columna nueva en `profiles`:
- `onboarded_at timestamptz nullable` — null = aún no completó onboarding.

RLS estándar: `auth.jwt()->>'sub' = clerk_id`.

#### UI

- Componente `<OnboardingOverlay>` que se renderiza como modal full-screen cuando hay sesión iniciada y `profiles.onboarded_at IS NULL`.
- Layout: 3 pasos editoriales con Fraunces italic en headlines.
  - **Paso 1**: divisa base + país (default COP / Colombia).
  - **Paso 2**: rango de ingreso mensual aproximado (chips de rangos, no input — friction baja).
  - **Paso 3**: método de ahorro (porcentaje del ingreso / monto fijo / sin plan / otro).
- Server action `completeOnboarding(input)`:
  - Persiste `profiles` (currency, locale, etc.).
  - Crea primer `savings_plans` row.
  - Setea `profiles.onboarded_at = now()`.
- Skip opcional ("Configurar más tarde") con confirmación: "Esto deshabilita las recomendaciones de ahorro. Puedes activar el plan desde Ajustes."
- Página nueva `/ajustes/perfil-financiero` para editar/cambiar plan después.

#### Edge cases

- Mobile: overlay full-screen sin scroll horizontal; touch targets ≥44px.
- Offline al primer login: skeleton + retry.
- `prefers-reduced-motion`: skip animaciones entre pasos.

---

### Fase 2 — Savings Tracker Histórico + Proyección

**Tamaño**: M
**Resuelve**: Idea 2 (valor diferencial — proyección con cambio de método)

#### Schema

Tabla nueva `savings_periods`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default random() | |
| `user_id` | uuid not null FK users.id cascade | |
| `plan_id` | uuid not null FK savings_plans.id | El plan vigente al cierre del período |
| `period_start` | date not null | |
| `period_end` | date not null | |
| `target_amount` | numeric(15,2) not null | Calculado del plan + ingreso del período |
| `achieved_amount` | numeric(15,2) not null default 0 | Net cash flow del período |
| `computed_at` | timestamptz not null default now() | |

Index: `(user_id, period_end desc)`

#### Cron

`/api/cron/close-savings-period` (schedule `0 3 1 * *` — día 1 de cada mes, 3am UTC).

Por cada usuario activo:
1. Resuelve el plan vigente el último día del mes anterior.
2. Calcula `target_amount` desde el plan + suma de ingresos del período.
3. Calcula `achieved_amount` como `sum(income.amount_base) − sum(expense.amount_base)`.
4. Upsert en `savings_periods` (idempotente por user + period_end).

#### UI

Página `/ahorro`:
- **Hero**: total acumulado en períodos pasados (sum achieved), Geist Mono enorme.
- **Timeline**: visx `BarStack` vertical — cada barra es un mes, color según status (cumplió / no llegó), height proporcional a achieved.
- **Lista editorial** debajo con cada mes: período, plan vigente, target, achieved, delta.
- **Proyección** hacia adelante: con plan activo + promedio achieved últimos 3 meses, traza línea a 12 meses. Sin Monte Carlo — proyección determinística simple.

Componente `<SavingsForecastChart>`:
- visx `LinePath` con 12 puntos (meses futuros).
- Banda sombreada para variabilidad (±1σ del achieved histórico).

#### Insights

Nuevo detector `savings_off_track`: si `achieved < target × 0.5` en 2 meses consecutivos, emite insight tipo `warning`.

---

### Fase 3 — Drift de Recurrentes + Gastos Hormiga + Recomendaciones + Vista Diaria

**Tamaño**: M
**Resuelve**: Idea 1 completa (sin "cierre de caja" como modo de negocio)

#### 3a. Drift de recurrentes (Idea 1.1)

**Schema**: extender `recurring_rules`:

| Campo | Tipo | Notas |
|---|---|---|
| `expected_day_of_month` | smallint nullable | Día esperado del cargo (1-31) |
| `tolerance_days` | smallint default 2 | Días de gracia antes de marcar drift |

**Detector** `recurring_drift`:
- Para cada rule activa, busca la última transacción matched (`description ILIKE rule.description`, `account_id = rule.account_id`, últimos 45 días).
- Si cayó fuera de `expected_day_of_month ± tolerance_days` → emite insight tipo `notice`.
- **Copy**: "{merchant} cobró el día {actual} ({delta} días después de lo usual). Esto desfasó tu corte de {account} por ~{amount}."
- **Signature**: `recurring_drift:{ruleId}:{YYYY-MM}`

**UI** en `/ajustes/recurring`: mini-timeline por regla (línea con días esperados marcados vs días reales de las últimas N apariciones).

#### 3b. Gastos hormiga (Idea 1.3)

**Detector** `ant_spending`:
- Por par `(user_id, merchant)`, suma expense del último mes.
- Si `individual < 5% del ingreso mensual base` AND `count >= 4` → emite insight tipo `notice`.
- **Copy**: "Gastaste {total} en {merchant} este mes ({count} compras). Pequeñas pero suman."
- **Signature**: `ant_spending:{merchant}:{YYYY-MM}`

#### 3c. Recomendaciones mensuales (Idea 1.4)

**Cron** nuevo `/api/cron/monthly-review` (día 1, 5am UTC).
- Snapshot agregado del mes pasado por usuario.
- Pasa a Claude Sonnet 4.6 con `generateObject` schema `{ habits: HabitRecommendation[] }`.
- Inserta hasta 3 insights tipo `recommendation` con `action` JSON apuntando a la acción concreta.

#### 3d. Vista diaria (clarificación del usuario sobre "cierre de caja")

**No schema nuevo. No modo de negocio.**

Solo UI: en `/transacciones`, picker de fecha que filtra a un solo día.
- URL: `/transacciones?day=YYYY-MM-DD`
- **Header cambia**: "Movimientos del {fecha}" + delta neto del día (ingresos − gastos) en Geist Mono grande.
- Lista debajo igual a la tabla normal pero solo del día.
- **Atajo**: Cmd+K → "Resumen del día" abre el picker.

---

### Fase 4 — Tarjeta de Crédito v2 (Esteroide visible)

**Tamaño**: L
**Resuelve**: Idea 3 completa + identidad visual

#### 4a. Identidad visual — ✅ Foundation en `7c212ad` · Imágenes pendientes

Estado del commit `7c212ad`:

- ✅ Schema (5 columnas en `accounts`) aplicado a prod.
- ✅ Catálogo `src/lib/cards/catalog.ts` con 9 bancos colombianos (Bancolombia, Davivienda, Nu, RappiCard, Falabella, BBVA, Scotiabank Colpatria, Banco de Bogotá, "Otro") y ~22 productos crédito/débito.
- ✅ `<CardVisual>` (client component, aspect 1.585:1, Next/Image con onError graceful a placeholder).
- ✅ Selector cascada en `NewAccountDialog` con preview vivo (banco → producto → red → últimos 4 + titular).
- ✅ Display en `/cuentas` y `/deudas`.
- ⏳ **Imágenes reales** en `/public/cards/` — pendiente de drop por el usuario (siguiendo naming en `/public/cards/README.md`).
- ⏳ **Dialog de edición de identidad visual** para cuentas YA EXISTENTES — falta. Hoy solo se setea al crear cuenta nueva.

#### 4b. Motor de búsqueda + Claude Vision (fallback de Opción C)

Cuando el usuario abre el selector de banco/producto y elige "no encuentro mi tarjeta":

**Flujo**:
1. Server action `findCardImage({ bankName, productName, brand })`.
2. Llama a Brave Search API: `tarjeta {bankName} {productName} {brand} colombia`.
3. Top 5 image results → URLs.
4. Pasa a Claude Sonnet 4.6 (Vision) con prompt: "¿Cuál de estas es el frente real de una tarjeta {bank} {product}? Devuelve un index 0-4 o null."
5. Si match → descarga, optimiza, sube a Vercel Blob, cachea path.
6. UI muestra el resultado para confirmación del usuario antes de persistir.

**Schema** nuevo `card_images_dynamic`:

| Campo | Tipo | Notas |
|---|---|---|
| `bank_slug` | text not null | PK compuesto |
| `product_slug` | text not null | PK compuesto |
| `brand` | text not null | PK compuesto |
| `image_url` | text not null | URL del Vercel Blob |
| `validated_at` | timestamptz not null | |

**Env nuevas**:
- `BRAVE_SEARCH_API_KEY`
- `VERCEL_BLOB_READ_WRITE_TOKEN`

**Costo estimado**: ~$0.30-1.50 USD por cada combinación nueva (cacheado de por vida después).

#### 4c. Mecánica per-tarjeta

**Schema** nuevo `credit_card_profiles`:

| Campo | Tipo | Notas |
|---|---|---|
| `account_id` | uuid PK FK accounts.id cascade | 1:1 |
| `allows_directed_payment` | boolean default false | Davivienda Zero sí; RappiCard no |
| `interest_rate_monthly` | numeric(5,4) | ej. 0.0250 = 2.5% mensual |
| `payment_policy` | enum('directed', 'fifo', 'proportional') | |
| `has_promotional_terms` | boolean default false | |
| `notes` | text | |

**UI**: en `/cuentas/{id}` cuando `type=credit_card`, panel plegable "Mecánica" con form opcional.

#### 4d. Analizador de compra (Idea 3 puro)

Widget en detalle de credit_card: **"¿Comprar con esta tarjeta?"**.

**Form**: monto + ¿cuotas? (dropdown 1/3/6/12/24).

**Output** (lógica determinística, sin LLM):
- "Faltan **N días al corte**. Esta compra entra al corte del día X que se paga el día Y."
- "**Pagando contado** el mes siguiente: {monto} + $0 intereses."
- "**Pagando mínimo**: ${cuota_mensual} durante N meses → ${total_pagado} ({intereses_totales} en intereses)."
- "Disponible actual ({limite − utilizado}) → esta compra deja tu utilización en **N%** ({safe/warning/peligroso})."
- Si `allows_directed_payment: false` → warning "Esta tarjeta no permite abonar a esta compra específica."
- Si otra cuenta del usuario tiene saldo suficiente Y mejor mecánica → sugerencia "Considera débito desde {Cuenta} — evitas intereses."

**Tool nueva en copiloto**: `proposeCardPurchase(amount, accountId, installments)` — devuelve análisis como ProposalCard sin abrir el widget.

---

### Fase 5 — Sincronización Bancaria

**Tamaño**: 5a M, 5b L
**Resuelve**: pregunta del usuario sobre sync Bancolombia y otros

#### 5a. Email parsing (primero, gratis, Bancolombia foco)

**Setup**:
- Resend Inbound (alternativa: Postmark) configurado para recibir emails en subdominio `inbox.finanzia.app`.
- Per-user alias: `u_${aliasToken}@inbox.finanzia.app`.
- Usuario configura forwarding desde Gmail/Outlook: `alertasynotificaciones@bancolombia.com.co` → su alias Finanzia.

**Schema** nuevo `email_inbox_aliases`:

| Campo | Tipo | Notas |
|---|---|---|
| `user_id` | uuid PK FK users.id cascade | |
| `alias_token` | text unique not null | Random 12 chars |
| `created_at` | timestamptz default now() | |

**Endpoint** `/api/inbound/email` (webhook Resend):
1. Verifica firma del provider.
2. Resuelve alias → user_id.
3. Parsea email con **regex específicas Bancolombia** (compras, transferencias, retiros).
4. Si regex no captura, fallback a Claude Sonnet 4.6 con el texto del email + schema Zod.
5. Crea transacción con `import_batch_id` apuntando a un batch sintético "Email Bancolombia".
6. Auto-categoriza con embeddings (pipeline existente del Step 9).

**UI**: nueva sección `/ajustes/integraciones-bancarias`:
- Card "Email Bancolombia" con la dirección personalizada + instructivo de cómo configurar forwarding en Gmail (capturas paso a paso).
- Histórico de últimos emails procesados con estado (ok / parser falló).
- Toggle on/off por proveedor.

**Env nueva**: `RESEND_INBOUND_SECRET`

**Limitaciones a comunicar al usuario**:
- Solo movimientos que Bancolombia notifica por email (no cubre TODO).
- No carga histórico — solo movimientos desde la conexión.
- Si Bancolombia cambia el formato del email, el parser se rompe (mitigado con LLM fallback).

#### 5b. Belvo (después, premium, multi-banco)

**Setup**:
- Cuenta Belvo (sandbox primero, después production).
- SDK Belvo Connect Widget integrado.

**Schema** nuevo `bank_links`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default random() | |
| `user_id` | uuid not null FK users.id cascade | |
| `provider` | text default 'belvo' | |
| `belvo_link_id` | text unique not null | |
| `institution_slug` | text not null | bancolombia / davivienda / nubank / etc. |
| `status` | enum('active', 'invalid', 'expired') | |
| `last_sync_at` | timestamptz | |
| `created_at` | timestamptz default now() | |

**Webhook** `/api/webhooks/belvo`:
- Verifica firma Belvo.
- Eventos: `new_transactions`, `link_invalid`, `historical_update`.
- Para `new_transactions` → descarga y persiste con auto-categorización.
- Para `link_invalid` → marca status, emite alert al usuario para re-auth.

**UI** en `/ajustes/integraciones-bancarias`:
- Botón "Conectar banco vía Belvo" que abre el Connect Widget.
- Si la conexión expira, badge negativo + botón re-auth.
- Lista de conexiones activas con last_sync_at.

**Env nuevas**: `BELVO_SECRET_ID`, `BELVO_SECRET_PASSWORD`, `BELVO_ENV` (sandbox/production)

**Costo estimado**: ~$0.20-0.40 USD por active link/mes + per-API call.

---

### Fase 6 — Reporte Mensual Editorial + Cash Flow Proyectado

**Tamaño**: L
**Resuelve**: capstone visual que ata todo el sprint

#### 6a. Reporte mensual

**Página** `/informes/{YYYY-MM}`:
- **Hero editorial**: "Tu mes en {Mes} {Year}", Fraunces italic en el headline.
- **KPIs**: ingreso, gasto, ahorro neto, % ahorro logrado del target. Geist Mono enorme.
- **Comparativa MoM**: este mes vs el anterior por categoría (top 8).
- **Insights destacados** del mes (de la tabla `insights`).
- **Recurrentes que registraron drift**.
- **Tarjetas**: utilización promedio, intereses pagados, deudas evolución.

**Cron** nuevo `/api/cron/monthly-report` (día 1 de cada mes, 6am UTC).
- Por cada usuario activo, genera el reporte y lo cachea en `monthly_reports`.

**Schema** nuevo `monthly_reports`:

| Campo | Tipo | Notas |
|---|---|---|
| `id` | uuid PK default random() | |
| `user_id` | uuid not null FK users.id cascade | |
| `period_start` | date not null | |
| `period_end` | date not null | |
| `data` | jsonb not null | KPIs precalculados |
| `generated_at` | timestamptz not null | |

Index: unique `(user_id, period_start)`.

**PDF export**:
- Endpoint `/api/informes/{YYYY-MM}/pdf`.
- Opción A: `@react-pdf/renderer` (más control de layout pero diverge del HTML).
- Opción B: Playwright en serverless function (fiel al HTML real).
- **Recomendación**: opción B — menos código duplicado.

#### 6b. Cash flow proyectado

Componente `<CashFlowForecast>` en `/dashboard` + página dedicada `/cash-flow`:
- Línea visx 30/60/90 días.
- **Inputs**: recurrentes próximas + presupuestos activos + ingresos esperados (basado en histórico).
- **Tres bandas**:
  - **Conservador**: ingresos = mín últimos 3 meses, gastos = máx.
  - **Esperado**: promedio.
  - **Optimista**: ingresos = máx, gastos = mín.
- Marcadores en fechas críticas (cortes de tarjeta, pagos recurrentes).

Helper nuevo `src/lib/forecast/cash-flow.ts`.

---

## Cosas que NO entran este sprint

| Item | Razón |
|---|---|
| Inversiones / holdings tracking | App-dentro-de-app. Diluye scope. v2. |
| Cripto tracking | Mismo argumento. v2. |
| OCR de tickets | Está en v2 del blueprint. Bandwidth limitado. |
| Voice input (Whisper) | Copiloto texto cubre el caso. v2. |
| Sharing en pareja (multi-tenant UI) | Multi-tenant ya está ready en data layer pero UX es densa. v2. |
| Webhooks customizados | Cero usuarios lo necesitan ahora. v2. |
| Notificaciones push / email (Resend transactional) | Útil pero no bloqueante. v2. |

---

## Decisiones aún pendientes

_(Todas resueltas al inicio de sesión 2026-05-27 — ver tabla de decisiones tomadas arriba.)_

---

## Pre-requisitos operativos (env vars + servicios)

**Antes de empezar Fase 4b** (motor búsqueda):
- Crear cuenta Brave Search API + pegar `BRAVE_SEARCH_API_KEY` en Vercel.
- Habilitar Vercel Blob en el proyecto + `BLOB_READ_WRITE_TOKEN`.

**Antes de empezar Fase 5a** (email parsing):
- Crear cuenta Resend (o Postmark) + configurar inbound routing.
- Configurar dominio MX records apuntando al provider.
- Pegar `RESEND_INBOUND_SECRET` en Vercel.

**Antes de empezar Fase 5b** (Belvo):
- Crear cuenta Belvo (sandbox primero).
- Pegar `BELVO_SECRET_ID`, `BELVO_SECRET_PASSWORD`, `BELVO_ENV` en Vercel.

---

## Estado del code base

- Branch: `main`
- Último commit: `7c212ad feat(cards): identidad visual de tarjeta — schema + catálogo + CardVisual`
- Working tree limpio (excepto `design_handoff_finanzia_brand/` que es referencia de marca, no se commitea).
- Migración Drizzle `0002_card_visual_identity.sql` ya aplicada en prod Supabase.
- Deploy de prod sigue siendo el de `4760b34` hasta que se pushee `7c212ad`. La nueva columna existe en DB pero el código aún no se publica.

---

## Cómo empezar la siguiente sesión

**Prompt sugerido a pegar al inicio**:

```
Continuamos el sprint de funcionalidades de Finanzia. Antes de codear,
leé estos archivos en orden:

1. docs/PROGRESS.md — estado de steps completados.
2. docs/ROADMAP-NEXT.md — plan completo del sprint (6 fases) con
   decisiones tomadas y pendientes.
3. memory/MEMORY.md — preferencias del usuario y feedback registrado.

Resumen del estado:
- Performance pass completa (Step 16) — desktop+mobile fluido.
- Foundation visual de tarjetas en código (commit 7c212ad) — schema
  aplicado, catálogo curado, CardVisual + dialog cascada implementados.
  Falta: dropear imágenes en /public/cards/ + opcionalmente pushear el
  commit 7c212ad para que prod tenga la feature.

Empezamos por la Fase 1 (Onboarding + Perfil de Ahorro) salvo que yo
indique otra. Antes de tocar schema o UI, confirmá conmigo:
  - Si el onboarding será obligatorio o saltable.
  - Si el set de preguntas del survey te parece bien.
  - Si querés ver mock-ups de cada paso antes de codear.
```

---

## Cómo actualizar este archivo

Cuando cierres una fase:
1. Marca la fase como ✅ en el index de roadmap.
2. Anota el SHA del commit que la cerró.
3. Mueve las decisiones tomadas que SE RESOLVIERON a la tabla principal.
4. Si surgió una decisión nueva durante la implementación, regístrala.
5. Si una decisión registrada quedó obsoleta, márcala como tal — NO la borres.
