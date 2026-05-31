# Finanzia — Blueprint

> Generado por The Architect el 2026-05-25
> Arquetipo: SaaS Web App con IA-first
> Idioma: Español (UI y copy). Código en inglés (estándar técnico).

---

## 0. Mandato Estético — Léelo antes de escribir una sola línea

Este es el contrato no negociable de diseño. Si una decisión visual o de interacción contradice algo aquí, **detente y reconsidera**. Finanzia debe sentirse como una herramienta financiera premium de pago — no como un dashboard genérico generado por IA.

**Lo que Finanzia NO es:**
- No es un dashboard tradicional con grilla de widgets coloridos
- No es una interfaz de chat con IA pegada al lateral
- No usa emojis en ningún lugar (ni UI, ni copy, ni iconos, ni comentarios visibles)
- No usa colores saturados, brillantes o "activos"
- No usa gradientes llamativos, bordes neón, ni glassmorphism exagerado
- No abusa de sombras dramáticas ni efectos de profundidad falsa
- No usa stock illustrations, ilustraciones 3D coloridas, ni mascotas
- No usa iconos con relleno colorido — solo iconos lineales de 1.5px stroke
- No usa botones con gradientes ni "shimmer effects"

**Lo que Finanzia SÍ es:**
- Limpio, profesional, minimalista, casi editorial
- Tipografía como protagonista — los números son los héroes
- Paleta restrained, casi monocromática, con un solo acento sutil
- Animaciones smooth, físicas, never bouncy (easing cubic-bezier muy suave)
- Espacios negativos generosos — el aire respira
- Sensación de seguridad y precisión (es dinero, no un juego)
- Interacciones cmd-key-first (Linear, Raycast, Arc — esa familia)
- Transiciones spatial entre vistas (View Transitions API), nunca page-load brusco
- Densidad de información alta cuando es necesario, pero jerarquía visual implacable

**Referencias estéticas obligatorias (estudiar antes de diseñar):**
1. **Linear** (linear.app) — densidad limpia, command palette, transiciones
2. **Mercury** (mercury.com) — fintech premium, monocromático, números enormes
3. **Arc Browser** (arc.net) — navegación evaporada, spatial feel
4. **Raycast** (raycast.com) — command-first, minimalismo profesional
5. **Stripe Dashboard** (dashboard.stripe.com) — datos financieros con personalidad
6. **Things 3** (culturedcode.com/things) — transiciones suaves, ritmo editorial

**Anti-referencias (lo que se debe evitar a toda costa):**
- Templates de dashboard de Tailwind UI con colores azul/verde brillantes
- Cualquier "AI chatbot SaaS template" de plantillas comerciales
- Dashboards con barras de progreso multicolor y emojis
- Productos con "AI" en el nombre que usan gradientes lila/rosa neón
- Interfaces tipo "Notion AI" con burbujas y emojis

---

## 1. Project Overview

### Vision

**Finanzia** es una webapp de finanzas personales con núcleo de inteligencia artificial. No es un registrador de gastos: es un *segundo cerebro financiero* que entiende los movimientos, detecta patrones, anticipa problemas y propone acciones concretas. La IA trabaja silenciosa de fondo (categorización automática, detección de anomalías, generación de insights) y se manifiesta de forma accionable en la UI; adicionalmente existe un copiloto conversacional ("Finanzia") accesible vía Cmd+K que puede simular escenarios y ejecutar cambios reales en presupuestos y metas.

Diseñado inicialmente para uso personal (single-tenant MVP, Colombia, COP/USD multi-divisa) pero con arquitectura multi-tenant lista desde día 1: cuando se abra signup público, no se reescribe nada. El producto debe sentirse digno de una suscripción premium fintech desde el primer pixel.

### Goals

- Eliminar la fricción de registrar movimientos (entrada manual rápida + import CSV inteligente + arquitectura preparada para Belvo Open Banking en v2)
- Convertir transacciones en *decisiones* mediante un motor de insights con LLM que genera cards accionables, no resúmenes vacíos
- Ofrecer un copiloto financiero conversacional con tool-calling real (no solo texto: ejecuta cambios)
- Mantener la UI minimalista, profesional y técnicamente diferenciada — anti-template
- Soportar multi-divisa nativo (COP base + USD secundaria, expandible)

### Success Metrics

- Tiempo desde abrir la app hasta registrar un movimiento: < 5 segundos
- Precisión de auto-categorización después de 30 días de uso: ≥ 90%
- Insights accionables generados por mes que el usuario marca como útiles: ≥ 70%
- Lighthouse Performance ≥ 95, Accessibility ≥ 95
- Sensación subjetiva: indistinguible de una app premium de pago de Y Combinator batch reciente

---

## 2. Tech Stack

| Capa | Tecnología | Por qué |
|------|-----------|---------|
| Framework | Next.js 15 (App Router) | RSC + Server Actions reducen JS cliente, ideal para app de datos sensibles |
| Lenguaje | TypeScript 5.5+ (strict) | Datos financieros = cero tolerancia a tipos rotos |
| Estilos | Tailwind CSS v4 | Tokens nativos en CSS, mejor perf, design tokens declarativos |
| Componentes | shadcn/ui (custom-themed) | Base sólida, copy-paste, fácil de adaptar al sistema Noir |
| Animación | `motion` (npm) + View Transitions API | Spatial transitions, micro-interacciones smooth |
| Charts | Visx (`@visx/*`) | Control total D3+React. Recharts es plantilla; Visx es craft |
| DB | Supabase Postgres | RLS por usuario, pgvector para embeddings, real-time disponible |
| ORM | Drizzle ORM | Performance + tipos limpios + SQL-like sin abstracción pesada |
| Auth | Clerk | MFA + passkeys gratis, multi-tenant nativo, webhook a Supabase para sync |
| IA | Vercel AI SDK — OpenAI `gpt-5.4-mini` (copiloto default) + Claude Sonnet 4.6 (fallback de categorización e insights) | Streaming, tool-calling, structured output. Resolución: key del usuario → AI Gateway → operador |
| Embeddings | OpenAI `text-embedding-3-small` via Vercel AI SDK | Costo bajo, 1536d, integrable con pgvector |
| Background jobs | Vercel Cron + Trigger.dev v4 | Cron diario para insights; Trigger para jobs largos (CSV import, sync futura) |
| Validación | Zod | Esquemas en cada frontera (Server Action, API, formulario, env) |
| Estado cliente | Zustand (UI) + TanStack Query v5 (datos vivos) | RSC para todo lo demás. Sin Redux |
| Forms | React Hook Form + Zod resolver | Performance, control granular, validación coherente |
| Currency | `dinero.js` v2 | Aritmética monetaria precisa (nunca `number` para dinero) |
| Exchange rates | `exchangerate.host` (free) o `openexchangerates.org` (paid) | Tasa diaria, cacheada en Redis/Upstash |
| Iconos | `lucide-react` (filtrado, sin variantes coloridas) | Stroke 1.5px, neutral, consistente |
| Fuentes | Inter (UI) + Geist Mono (números) + Fraunces (acentos editoriales) | Self-hosted via `next/font` |
| Caché edge | Upstash Redis | Rate limiting + cache de tasas de cambio + sesión de IA |
| Hosting | Vercel | Edge runtime, Cron, Workflows, AI Gateway todo integrado |
| Observabilidad | Vercel Analytics + Sentry | Errores en frontera y performance |
| Email (futuro) | Resend | Notificaciones por email cuando se active alerts |
| Open Banking (v2) | Belvo (Colombia) | API LATAM líder, cobertura bancaria amplia |
| Package Manager | pnpm | Más rápido, monorepo-ready si crece |

---

## 3. Directory Structure

```
finanzia/
├── src/
│   ├── app/
│   │   ├── (marketing)/                  # Public, sin auth (preparado para landing futura)
│   │   │   └── layout.tsx
│   │   ├── (app)/                        # App autenticada — protegida por middleware
│   │   │   ├── layout.tsx                # Root layout: rail + Cmd+K + Toaster
│   │   │   ├── page.tsx                  # Inicio: patrimonio neto + insights + flujo
│   │   │   ├── movimientos/
│   │   │   │   ├── page.tsx              # Lista de transacciones con filtros
│   │   │   │   ├── nuevo/page.tsx        # Crear transacción
│   │   │   │   └── [id]/page.tsx         # Detalle/editar
│   │   │   ├── cuentas/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── presupuestos/
│   │   │   │   └── page.tsx
│   │   │   ├── metas/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── insights/
│   │   │   │   └── page.tsx              # Historial completo de insights
│   │   │   ├── import/
│   │   │   │   └── page.tsx              # Wizard de import CSV
│   │   │   └── ajustes/
│   │   │       ├── page.tsx              # Perfil, preferencias
│   │   │       ├── categorias/page.tsx   # Gestión de categorías
│   │   │       └── divisas/page.tsx      # Multi-divisa
│   │   ├── api/
│   │   │   ├── webhooks/
│   │   │   │   └── clerk/route.ts        # Sync user a Supabase
│   │   │   ├── ai/
│   │   │   │   ├── chat/route.ts         # Stream del copiloto con tool-calling
│   │   │   │   ├── categorize/route.ts   # Auto-categorización
│   │   │   │   └── insights/route.ts     # Generación on-demand
│   │   │   ├── transactions/route.ts
│   │   │   ├── import/route.ts           # Trigger del job de import
│   │   │   └── cron/
│   │   │       └── insights/route.ts     # Cron diario
│   │   ├── layout.tsx                    # Root: ClerkProvider, fonts, theme
│   │   ├── globals.css                   # Tailwind v4 + tokens
│   │   └── not-found.tsx
│   ├── components/
│   │   ├── ui/                           # shadcn primitivos customizados al sistema Noir
│   │   ├── app/
│   │   │   ├── rail/                     # Navegación lateral mínima 56px
│   │   │   ├── command/                  # Cmd+K palette
│   │   │   ├── insight-card/             # Cápsula de insight con acción/dismiss
│   │   │   ├── transaction-row/
│   │   │   ├── amount/                   # Componente Amount (formato, signo, divisa)
│   │   │   ├── chart/                    # Wrappers Visx
│   │   │   ├── empty-state/              # Estados vacíos editoriales
│   │   │   └── view-transition/          # Wrapper para View Transitions API
│   │   ├── copilot/                      # Copiloto Finanzia (Cmd+K → IA)
│   │   │   ├── conversation.tsx
│   │   │   ├── message.tsx
│   │   │   ├── tool-confirmation.tsx     # UI para confirmar acciones del LLM
│   │   │   └── streaming-text.tsx
│   │   └── shared/
│   ├── lib/
│   │   ├── db/
│   │   │   ├── schema.ts                 # Drizzle schema completo
│   │   │   ├── client.ts                 # Drizzle client
│   │   │   └── queries/                  # Queries reutilizables tipadas
│   │   ├── ai/
│   │   │   ├── client.ts                 # Vercel AI SDK + Anthropic
│   │   │   ├── prompts/                  # Todos los system prompts versionados
│   │   │   ├── tools/                    # Tool definitions (Zod schemas)
│   │   │   ├── categorize.ts             # Auto-categorización pipeline
│   │   │   ├── insights.ts               # Insights generation pipeline
│   │   │   └── embeddings.ts
│   │   ├── currency/
│   │   │   ├── format.ts                 # Format con Intl + dinero.js
│   │   │   ├── convert.ts                # Conversión multi-divisa
│   │   │   └── rates.ts                  # Fetch tasas + cache
│   │   ├── csv/
│   │   │   ├── parse.ts                  # Papa Parse wrapper
│   │   │   └── mapping.ts                # Detección inteligente de columnas
│   │   ├── auth/
│   │   │   ├── server.ts                 # Helpers server-side
│   │   │   └── sync.ts                   # Sync Clerk → DB
│   │   ├── motion/
│   │   │   ├── easings.ts                # Curvas globales
│   │   │   ├── durations.ts              # Duraciones globales
│   │   │   └── variants.ts               # Motion variants reutilizables
│   │   ├── design/
│   │   │   ├── tokens.ts                 # Design tokens en TS
│   │   │   └── icons.ts                  # Iconos curados de lucide
│   │   ├── utils.ts                      # cn(), formatters
│   │   └── env.ts                        # Zod schema de env vars
│   ├── types/
│   │   ├── transaction.ts
│   │   ├── insight.ts
│   │   ├── tool-call.ts
│   │   └── index.ts
│   ├── hooks/
│   │   ├── use-command-palette.ts
│   │   ├── use-view-transition.ts
│   │   ├── use-currency-format.ts
│   │   └── use-keyboard.ts
│   ├── stores/                           # Zustand stores (UI-only)
│   │   ├── command-store.ts
│   │   └── copilot-store.ts
│   └── middleware.ts                     # Clerk middleware
├── drizzle/                              # Migraciones generadas
│   └── migrations/
├── drizzle.config.ts
├── public/
│   ├── fonts/                            # Self-hosted fonts si aplica
│   └── og-image.png
├── .env.example
├── .env.local                            # gitignored
├── components.json                       # shadcn config
├── next.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── package.json
├── pnpm-lock.yaml
├── README.md
└── CLAUDE.md                             # Ver Sección 15
```

---

## 4. Data Model

### Entidades

**users** (sincronizado desde Clerk via webhook)

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | mismo `clerk_id` mapeado |
| clerk_id | text unique not null | ID de Clerk |
| email | text not null | |
| name | text | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**profiles**

| Campo | Tipo | Notas |
|-------|------|-------|
| user_id | uuid PK FK→users.id | |
| base_currency | text not null default 'COP' | ISO 4217 |
| secondary_currencies | text[] default ARRAY['USD'] | |
| locale | text default 'es-CO' | |
| timezone | text default 'America/Bogota' | |
| ai_profile | jsonb | Perfil financiero generado por IA (income range, goals, risk, etc.) |
| ai_enabled | boolean default true | Toggle para apagar IA |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**accounts** (cuentas: débito, ahorro, crédito, efectivo, cripto)

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | RLS |
| name | text not null | "Bancolombia Ahorros" |
| type | enum | `checking|savings|credit_card|cash|investment|crypto|other` |
| currency | text not null | ISO 4217 |
| initial_balance | numeric(15,2) not null default 0 | |
| current_balance | numeric(15,2) generated | calculado en view o trigger |
| credit_limit | numeric(15,2) | solo si type=credit_card |
| statement_day | smallint | día de corte (credit_card) |
| payment_day | smallint | día de pago (credit_card) |
| color | text | hex desde paleta limitada |
| icon | text | nombre de icono curado |
| archived | boolean default false | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**categories**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id nullable | null = sistema (semilla) |
| parent_id | uuid FK→categories.id nullable | jerarquía 1 nivel |
| name | text not null | |
| kind | enum | `income|expense|transfer` |
| icon | text | curado |
| color | text | de paleta restrained |
| sort_order | int default 0 | |
| archived | boolean default false | |
| created_at | timestamptz | |

**transactions**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | RLS |
| account_id | uuid FK→accounts.id | |
| category_id | uuid FK→categories.id nullable | null = sin categorizar |
| date | date not null | fecha de la transacción |
| amount_original | numeric(15,2) not null | en currency original |
| currency | text not null | ISO 4217 |
| amount_base | numeric(15,2) not null | convertido a base_currency del user |
| exchange_rate | numeric(15,6) | snapshot al momento |
| description | text not null | |
| merchant | text | parseado/limpiado |
| kind | enum | `income|expense|transfer` |
| transfer_account_id | uuid FK→accounts.id nullable | si kind=transfer |
| notes | text | |
| tags | text[] | |
| recurring_rule_id | uuid FK→recurring_rules.id nullable | si proviene de recurring |
| import_batch_id | uuid FK→import_batches.id nullable | trazabilidad CSV |
| ai_categorized | boolean default false | true si la asignó la IA |
| ai_confidence | numeric(3,2) | 0.00–1.00 |
| user_corrected | boolean default false | true si el user cambió la categoría IA |
| embedding | vector(1536) | pgvector — para semantic search |
| created_at | timestamptz | |
| updated_at | timestamptz | |
| deleted_at | timestamptz nullable | soft delete |

**budgets**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | |
| category_id | uuid FK→categories.id | |
| amount | numeric(15,2) not null | en base_currency |
| period | enum | `monthly|weekly|yearly` |
| start_date | date not null | |
| rollover | boolean default false | acumular saldo no usado |
| archived | boolean default false | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**goals**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | |
| name | text not null | "Vacaciones Europa" |
| target_amount | numeric(15,2) not null | |
| currency | text not null | |
| target_date | date | opcional |
| linked_account_id | uuid FK→accounts.id nullable | si está atada a una cuenta |
| current_amount | numeric(15,2) default 0 | calculado |
| status | enum | `active|paused|completed|abandoned` |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**recurring_rules**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | |
| account_id | uuid FK→accounts.id | |
| category_id | uuid FK→categories.id | |
| description | text not null | |
| amount | numeric(15,2) not null | |
| currency | text not null | |
| kind | enum | `income|expense` |
| frequency | enum | `daily|weekly|biweekly|monthly|quarterly|yearly` |
| day_of_month | smallint | si frequency=monthly |
| day_of_week | smallint | si frequency=weekly |
| next_run | date | calculado |
| last_run | date | |
| active | boolean default true | |
| auto_create | boolean default true | si false: solo recordatorio |
| created_at | timestamptz | |

**insights**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | |
| kind | enum | `anomaly|trend|forecast|recommendation|achievement` |
| severity | enum | `info|notice|warning` |
| title | text not null | |
| body | text not null | máx 2 frases |
| data | jsonb | numbers/refs que la card necesita renderizar |
| action | jsonb nullable | `{ type, payload }` para CTA accionable |
| status | enum | `unread|read|dismissed|acted` |
| period_start | date | rango temporal del insight |
| period_end | date | |
| generated_by | text | versión del prompt/modelo |
| created_at | timestamptz | |
| acted_at | timestamptz | |

**conversations** (copiloto)

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | |
| title | text | auto-generado |
| created_at | timestamptz | |
| updated_at | timestamptz | |

**messages**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| conversation_id | uuid FK→conversations.id | |
| role | enum | `user|assistant|tool` |
| content | jsonb | array de parts (text, tool_use, tool_result) — formato AI SDK |
| created_at | timestamptz | |

**alerts**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | |
| kind | enum | `unusual_spend|budget_exceeded|recurring_due|low_balance|goal_at_risk` |
| ref_id | uuid | id de la entidad referida |
| message | text | |
| read | boolean default false | |
| created_at | timestamptz | |

**import_batches**

| Campo | Tipo | Notas |
|-------|------|-------|
| id | uuid PK | |
| user_id | uuid FK→users.id | |
| account_id | uuid FK→accounts.id | |
| filename | text | |
| total_rows | int | |
| imported_rows | int | |
| status | enum | `pending|processing|completed|failed` |
| mapping | jsonb | columna CSV → campo |
| errors | jsonb | array de errores por fila |
| created_at | timestamptz | |
| completed_at | timestamptz | |

**exchange_rates** (cache)

| Campo | Tipo | Notas |
|-------|------|-------|
| date | date | parte de PK |
| from_currency | text | parte de PK |
| to_currency | text | parte de PK |
| rate | numeric(15,6) | |
| source | text | "exchangerate.host" |
| fetched_at | timestamptz | |

### Relaciones clave

- `users` 1—1 `profiles`
- `users` 1—N `accounts`, `categories`, `transactions`, `budgets`, `goals`, `recurring_rules`, `insights`, `conversations`, `alerts`
- `accounts` 1—N `transactions`
- `categories` 1—N `transactions`, `budgets`
- `transactions` con embedding → semantic search via pgvector
- Todas las tablas con `user_id` tienen RLS policy: `auth.uid() = user_id` (Supabase)

### Drizzle schema (resumen — ver `src/lib/db/schema.ts` completo en Build Order)

```typescript
// fragmento ilustrativo — el archivo completo se genera en Step 2
import { pgTable, uuid, text, numeric, timestamp, boolean, date, smallint, integer, jsonb, pgEnum, vector, primaryKey } from 'drizzle-orm/pg-core'

export const accountType = pgEnum('account_type', ['checking', 'savings', 'credit_card', 'cash', 'investment', 'crypto', 'other'])
export const transactionKind = pgEnum('transaction_kind', ['income', 'expense', 'transfer'])
export const insightKind = pgEnum('insight_kind', ['anomaly', 'trend', 'forecast', 'recommendation', 'achievement'])
// ... resto de enums

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  clerkId: text('clerk_id').notNull().unique(),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
})

export const transactions = pgTable('transactions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accountId: uuid('account_id').notNull().references(() => accounts.id, { onDelete: 'restrict' }),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  date: date('date').notNull(),
  amountOriginal: numeric('amount_original', { precision: 15, scale: 2 }).notNull(),
  currency: text('currency').notNull(),
  amountBase: numeric('amount_base', { precision: 15, scale: 2 }).notNull(),
  exchangeRate: numeric('exchange_rate', { precision: 15, scale: 6 }),
  description: text('description').notNull(),
  merchant: text('merchant'),
  kind: transactionKind('kind').notNull(),
  // ... resto
  embedding: vector('embedding', { dimensions: 1536 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp('deleted_at', { withTimezone: true }),
})
// ... resto de tablas en el archivo real
```

### Índices críticos

```sql
CREATE INDEX idx_transactions_user_date ON transactions (user_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_user_category ON transactions (user_id, category_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_account ON transactions (account_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_transactions_embedding ON transactions USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_insights_user_status ON insights (user_id, status, created_at DESC);
```

### Row Level Security (Supabase)

Toda tabla con `user_id` debe tener RLS habilitada con la policy:

```sql
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY transactions_isolation ON transactions
  FOR ALL USING (user_id = (SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'))
  WITH CHECK (user_id = (SELECT id FROM users WHERE clerk_id = auth.jwt() ->> 'sub'));
```

Replicar el patrón para cada tabla con `user_id`.

---

## 5. API Design

### Filosofía

- **Server Actions** son la API principal para mutaciones desde RSC
- **Route handlers** (`/api/*`) solo para: webhooks, streams de IA, cron, llamadas desde cliente que no encajan en Server Action (ej. multipart de CSV)
- **Toda frontera valida con Zod**
- **Toda response sigue formato consistente**: `{ ok: true, data: T } | { ok: false, error: { code, message, fields? } }`

### Server Actions (resumen)

| Acción | Archivo | Hace |
|--------|---------|------|
| createTransaction | `app/(app)/movimientos/actions.ts` | Crea, dispara auto-categorización async |
| updateTransaction | idem | Update + recategorize si description cambió mucho |
| deleteTransaction | idem | Soft delete |
| createAccount | `app/(app)/cuentas/actions.ts` | |
| createBudget | `app/(app)/presupuestos/actions.ts` | |
| createGoal | `app/(app)/metas/actions.ts` | |
| dismissInsight | `app/(app)/insights/actions.ts` | status → dismissed |
| actInsight | idem | status → acted, ejecuta `action.payload` |

### Route Handlers

| Método | Path | Descripción | Auth |
|--------|------|-------------|------|
| POST | `/api/webhooks/clerk` | Sync user create/update/delete a Supabase | Svix signature |
| POST | `/api/ai/chat` | Stream del copiloto, soporta tool-calling | Clerk |
| POST | `/api/ai/categorize` | Categoriza una o varias transacciones | Clerk |
| POST | `/api/ai/insights` | Trigger manual de generación de insights | Clerk |
| POST | `/api/import` | Inicia job de import CSV en Trigger.dev | Clerk |
| GET | `/api/import/[batchId]` | Estado del job | Clerk |
| GET | `/api/cron/insights` | Cron diario — genera insights para todos | Vercel Cron signature |
| GET | `/api/cron/recurring` | Aplica recurring rules pendientes | Vercel Cron signature |
| GET | `/api/cron/exchange-rates` | Refresca tasas | Vercel Cron signature |

### Detalle: POST `/api/ai/chat`

**Request body** (formato Vercel AI SDK):
```typescript
{
  id: string,                    // conversation id
  messages: ModelMessage[],      // formato AI SDK
}
```

**Response**: stream de eventos AI SDK con `text-delta`, `tool-call`, `tool-result`. Cliente usa `useChat()` del AI SDK.

**Tool definitions disponibles** (en `src/lib/ai/tools/`):
```typescript
- getTransactions(filters): retorna últimas N transacciones filtradas
- getBudgetStatus(month): estado actual de presupuestos
- getCashflow(from, to): flujo de caja agregado
- getGoalProgress(goalId?): progreso de meta(s)
- simulateScenario(changes): simulación what-if de presupuestos
- createBudget(category, amount): propone crear presupuesto (requiere confirmación user)
- updateBudget(id, amount): propone modificar (requiere confirmación)
- createGoal(name, amount, date): propone crear meta (requiere confirmación)
- adjustGoal(id, target): propone ajustar (requiere confirmación)
```

**Pattern de confirmación**: las tools que mutan datos NO ejecutan directamente — retornan un "propuesta" que la UI renderiza como card de confirmación. Solo cuando el user acepta, se ejecuta una Server Action que sí muta. Esto es crítico: nunca dejar que el LLM modifique dinero sin doble check del usuario.

### Detalle: POST `/api/ai/categorize`

**Request body**:
```typescript
{
  transactionIds: string[]      // máx 50 por request
}
```

**Pipeline**:
1. Para cada transacción, busca top-5 transacciones similares del usuario via pgvector (`embedding <=> query_embedding`)
2. Construye few-shot prompt con esas 5 + categorías disponibles del usuario
3. Claude Sonnet con `generateObject` (Zod schema) devuelve `{ categoryId, confidence, reason }`
4. Si `confidence >= 0.75`: aplica. Si menor: deja sin categorizar (no inventa)
5. Actualiza `transactions.category_id`, `ai_categorized=true`, `ai_confidence`

### Detalle: GET `/api/cron/insights` (diario, 6am Bogota)

**Pipeline por usuario** (paralelizado en batch de 10):
1. Calcula KPIs del último mes vs. los 3 anteriores (gasto por categoría, ingreso, ahorro neto)
2. Detecta anomalías (z-score > 1.5 vs. media histórica) → genera card `anomaly`
3. Calcula forecasts simples (lineal) → si gasto proyectado > ingreso, genera card `forecast`
4. Pasa los KPIs + anomalías a Claude con `generateObject` para producir títulos/copy humano + acción concreta
5. Inserta `insights` con status=unread, max 3 nuevos por día por usuario
6. Marca `acted_at` o expiry de insights antiguos según reglas

---

## 6. Frontend Architecture

### Páginas / Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Inicio: hero del patrimonio neto, flujo del mes, 1-3 insights, últimos movimientos |
| `/movimientos` | Lista densa con filtros (fecha, cuenta, categoría, búsqueda semántica) |
| `/movimientos/nuevo` | Form rápido (cmd+N abre overlay) |
| `/movimientos/[id]` | Detalle con timeline de cambios |
| `/cuentas` | Cards de cuentas con saldo y mini-sparkline |
| `/cuentas/[id]` | Detalle: saldo, transacciones, gráfico de balance |
| `/presupuestos` | Lista por categoría con barras de progreso ultra-minimalistas |
| `/metas` | Cards de metas con progreso editorial (no barras de carga genéricas) |
| `/metas/[id]` | Detalle con contribuciones y proyección |
| `/insights` | Feed completo de insights con filtros |
| `/import` | Wizard 3-pasos: upload → mapping → preview → confirm |
| `/ajustes` + sub-rutas | Profile, categorias, divisas |

### Component hierarchy (página Inicio)

```
HomePage (RSC)
├─ NetWorthHero (RSC)
│  ├─ Amount (display gigante, Geist Mono)
│  └─ DeltaIndicator (variación vs mes anterior)
├─ CashflowChart (Client, Visx)
│  └─ datos prefetched desde RSC props
├─ InsightsStack (Client — animaciones, dismissable)
│  └─ InsightCard × N
│     ├─ title + body
│     └─ ActionButton (CTA → Server Action o modal de confirm)
└─ RecentTransactions (RSC)
   └─ TransactionRow × 10
      ├─ MerchantText
      ├─ CategoryChip
      ├─ Amount (signed)
      └─ DateRelative
```

### Estado

- **Server-first**: todas las páginas son RSC que hacen queries directos a Drizzle. Cero `useEffect` para fetch inicial.
- **Mutations**: Server Actions con `revalidatePath` después.
- **TanStack Query**: solo para datos vivos del copiloto y polling de import_batches en progreso.
- **Zustand**:
  - `useCommandStore` — apertura/cierre del Cmd+K, vista actual (search | copilot)
  - `useCopilotStore` — estado de la conversación activa (id, isStreaming)
- **URL state**: filtros de listas en search params con `nuqs`.
- **Theme**: `next-themes` con default `dark`, persistencia en cookie.

### View Transitions

Usar la **View Transitions API** (Next 15 soporta nativa via `experimental.viewTransition`) para todas las navegaciones entre rutas de `(app)`. Definir transiciones globales en `globals.css`:

```css
@view-transition { navigation: auto; }

::view-transition-old(root),
::view-transition-new(root) {
  animation-duration: 320ms;
  animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
}

::view-transition-old(root) {
  animation-name: fade-out;
}
::view-transition-new(root) {
  animation-name: fade-slide-in;
}

@keyframes fade-out { to { opacity: 0; } }
@keyframes fade-slide-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

Elementos compartidos entre vistas (ej. el monto del patrimonio neto si aparece en /inicio y /cuentas) usan `view-transition-name: networth` para transición continua.

---

## 7. Design System — Finanzia Noir

### Filosofía

**"El Estudio Financiero"**. No es un cockpit ni un panel administrativo. Es un espacio editorial donde tu dinero vive. La UI es plataforma para los números, no espectáculo. La IA aparece como presencia ambiental, jamás como protagonista visual.

**Reglas tipográficas inmutables:**
- Los números financieros siempre `Geist Mono` con `font-variant-numeric: tabular-nums`
- Los montos hero (>$1M COP, patrimonio neto, totales) usan tamaño 56px–96px
- Pesos de texto: 400 (body), 500 (énfasis), 600 (títulos sección), 700 (display)
- Nunca usar uppercase salvo en chips/labels de 11px con letter-spacing 0.08em

### Colores

**Modo oscuro (default):**

| Rol | Hex | Uso |
|-----|-----|-----|
| `bg` | `#0A0A0B` | Background base, casi negro |
| `surface` | `#141416` | Cards, paneles |
| `surface-elevated` | `#1C1C1F` | Modals, command palette |
| `surface-hover` | `#222226` | Hover sobre surface |
| `border` | `#26262A` | Bordes sutiles |
| `border-emphasis` | `#34343A` | Bordes en focus/hover |
| `text` | `#FAFAFA` | Texto primario |
| `text-secondary` | `#A1A1A8` | Texto secundario, labels |
| `text-tertiary` | `#6B6B72` | Placeholders, helpers |
| `accent-ai` | `#B8A6F5` | **Único acento**: presencia de IA |
| `accent-ai-subtle` | `#B8A6F520` | Backgrounds de cards de IA (alpha 12%) |
| `positive` | `#7FB89F` | Ingresos, metas cumplidas |
| `positive-subtle` | `#7FB89F1A` | |
| `negative` | `#D4938A` | Gastos relevantes, alertas |
| `negative-subtle` | `#D4938A1A` | |
| `warning` | `#D4B58A` | Advertencias (uso parco) |
| `focus-ring` | `#FAFAFA40` | Ring de accesibilidad |

**Modo claro:**

| Rol | Hex |
|-----|-----|
| `bg` | `#FAFAF9` |
| `surface` | `#FFFFFF` |
| `surface-elevated` | `#FFFFFF` |
| `surface-hover` | `#F4F4F2` |
| `border` | `#E7E5E4` |
| `border-emphasis` | `#D6D3D1` |
| `text` | `#0A0A0B` |
| `text-secondary` | `#52525B` |
| `text-tertiary` | `#A1A1A8` |
| `accent-ai` | `#7C6FCD` (mismo lila pero −12% luminosidad) |
| `positive` | `#5A9279` |
| `negative` | `#B57167` |

**Reglas de uso del color:**
- **El color NO comunica jerarquía.** La tipografía sí.
- `accent-ai` solo aparece en: cards de insight, el icono del copiloto, el avatar del assistant en mensajes, el cursor de typing del LLM, y el indicador de "Finanzia está pensando…". Jamás en botones primarios genéricos.
- `positive` y `negative` solo aparecen en montos firmados (+/−) y barras de presupuesto/meta. Nunca en botones de "Guardar" o "Cancelar".
- Los botones primarios usan `text` sobre `surface-elevated` con border de 1px — **monocromáticos**.
- Los CTAs destructivos (`Eliminar cuenta`) usan border negativo + texto negativo, sin fill — la acción debe sentirse pesada, no festiva.
- Cero gradientes. Cero glassmorphism. Cero glow.

### Tipografía

| Rol | Fuente | Tamaño | Peso | Tracking |
|-----|--------|--------|------|----------|
| Display XL | Inter Display | 96px / 1.0 | 700 | -0.04em |
| Display L | Inter Display | 72px / 1.0 | 700 | -0.035em |
| Display M | Inter Display | 56px / 1.05 | 600 | -0.03em |
| Heading XL | Inter | 32px / 1.15 | 600 | -0.02em |
| Heading L | Inter | 24px / 1.2 | 600 | -0.015em |
| Heading M | Inter | 20px / 1.25 | 600 | -0.01em |
| Heading S | Inter | 16px / 1.3 | 600 | 0 |
| Body L | Inter | 16px / 1.5 | 400 | 0 |
| Body | Inter | 14px / 1.5 | 400 | 0 |
| Body S | Inter | 13px / 1.45 | 400 | 0 |
| Caption | Inter | 12px / 1.4 | 500 | 0.01em |
| Label | Inter | 11px / 1.3 | 500 | 0.08em uppercase |
| Mono XL | Geist Mono | 72–96px / 1.0 | 500 | -0.02em |
| Mono L | Geist Mono | 32–56px / 1.0 | 500 | -0.01em |
| Mono | Geist Mono | 14–16px / 1.4 | 500 | 0 |
| Editorial | Fraunces | 18–24px / 1.4 | 400 italic | -0.01em |

`Fraunces` se usa con extrema parsimonia: empty states ("Aún no has registrado ningún movimiento"), onboarding hero, copy del copiloto en mensajes de bienvenida. Jamás en UI funcional. Aporta el toque humano que diferencia de plantillas.

### Spacing & Layout

- Base unit: **4px**
- Scale: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128
- Max content width: **1240px** centrado
- Gutter desktop: **40px**, tablet: **24px**, móvil: **16px**
- Rail izquierda: **56px** ancho fijo
- Topbar: **56px** alto fijo
- Comando palette: **640px** ancho, centrado, top: 14vh

### Border radius

- 4px: chips, inputs pequeños
- 8px: inputs, botones, rows
- 12px: cards, paneles
- 16px: modals, command palette
- 999px: avatars, indicadores circulares
- **Nunca 0px en surfaces.** Nunca radius mayor a 16px excepto avatars.

### Sombras

Sombras casi imperceptibles. Cero drama.

```css
--shadow-xs: 0 1px 2px 0 rgb(0 0 0 / 0.04);
--shadow-sm: 0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06);
--shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06);
--shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.10), 0 4px 6px -4px rgb(0 0 0 / 0.06);
```

Modo dark: usar shadows con opacidad MÁS BAJA aún (0.02–0.06 max). El contraste viene de surfaces elevadas, no sombras dramáticas.

### Component style

- **Botones**: 36px alto default, 40px medium, 32px small. Sin uppercase. Sin shadow. Border de 1px, hover sutiliza el bg.
- **Inputs**: 40px alto, border 1px, focus ring con `accent-ai/40`, no glow. Placeholder en `text-tertiary`.
- **Cards**: surface + border 1px + radius 12px. **Nunca dos cards anidadas con borders dobles** — extraer subseción en lugar de anidar.
- **Tables**: filas separadas por border-bottom de 1px en `border`, no zebra striping, hover sutiliza el row.
- **Chips**: pill 24px alto, border + bg transparente + texto secundario. La categoría usa color de la categoría con alpha 15% como bg.
- **Empty states**: usan tipografía `Fraunces` para el headline, body en Inter, ilustración estrictamente prohibida — el vacío es el mensaje.
- **Loading**: skeleton shimmer SOLO usando `surface-hover` animando opacidad (no gradient sweep cliché). Spinners: línea de 2px dando vueltas, nunca círculos con relleno.
- **Toasts**: aparecen desde arriba-derecha, slide-down 240ms, ancho 360px, dismissable con clic en cualquier parte.
- **Tooltips**: 12px tipografía, padding 8px 10px, fade 160ms.

### Iconografía

- `lucide-react` con stroke `1.5px`, tamaño 16/20/24px
- **Lista curada** en `src/lib/design/icons.ts` — solo se importan iconos aprobados, sin variantes filled
- Iconos prohibidos: cualquier icono con colores integrados, smileys, emojis disfrazados de iconos
- Color del icono = `currentColor` siempre

### Animación — easings y durations

Curva única de easing en TODA la app (excepto físicas):

```typescript
// src/lib/motion/easings.ts
export const easings = {
  smooth: [0.32, 0.72, 0, 1] as const,         // default — todo lo UI
  smoothOut: [0.16, 1, 0.3, 1] as const,       // salidas de elementos
  spring: { type: 'spring', stiffness: 320, damping: 32, mass: 0.8 }, // físicas
}

export const durations = {
  instant: 120,    // hover de chips, focus rings
  fast: 220,       // botones, inputs, micro-interacciones
  base: 320,       // cards entering, view transitions
  slow: 480,       // hero animations, view-to-view spatial
  ambient: 800,    // pulse del avatar de IA cuando "piensa"
} as const
```

**Animaciones obligatorias:**
- Cada elemento que entra en viewport: opacity 0 → 1 + translateY 8px → 0 en 320ms con `smooth`
- InsightCards al aparecer: stagger de 60ms entre cards, scale 0.98 → 1
- Modales: spring entrance, fade-scale exit 220ms
- Command Palette: fade-up 8px desde 14vh, 220ms
- View transitions: 320ms, root crossfade
- Indicador "Finanzia está pensando": dot pulse de `accent-ai`, 800ms, ease-in-out

**Animaciones PROHIBIDAS:**
- Bouncy springs (overshoot visible)
- Rotaciones decorativas
- Particles, confetti, etc. (nunca, ni siquiera en celebración de meta)
- Shimmer/glow effects
- Parallax
- Anything wobbly

### Accesibilidad

- Contraste mínimo: AA en todo, AAA en texto principal
- Focus visible siempre — ring `accent-ai/40` 2px
- Reduced motion: respetar `prefers-reduced-motion: reduce` → todas las transiciones a 0ms, salvo opacidad < 200ms
- Navegación completa por teclado (rail, Cmd+K, tablas, modales)
- ARIA labels en todo icon-only button
- Anuncios en cambios de estado críticos (`aria-live`)

---

## 8. Authentication & Authorization

### Auth flow

1. Usuario aterriza en `/` → si no está autenticado, redirect a `/sign-in` (Clerk hosted con tema custom para matchear paleta Noir)
2. Sign-in con: Email + password, Google, Apple (configurables en Clerk dashboard)
3. Post sign-up: Clerk dispara webhook `user.created` → handler en `/api/webhooks/clerk` crea `users` + `profiles` con defaults (`base_currency='COP'`)
4. Redirect a `/?onboarding=1` → muestra overlay de bienvenida que pide 3 cosas: divisa primaria, primera cuenta, importar CSV o registrar primer movimiento
5. Sesión activa en todas las rutas `(app)/*` via Clerk middleware

### Protected routes

- Públicas: `/sign-in`, `/sign-up`, `/api/webhooks/clerk` (verificado por Svix)
- Protegidas: todo lo demás bajo `(app)` y `/api/*` excepto webhooks y crons
- Crons protegidos por header `Authorization: Bearer ${CRON_SECRET}` validado en route handler

### Roles & permissions

MVP single-tenant: cada user solo accede a sus datos. No hay roles. RLS de Supabase + filtro por `user_id` en todo query.

Futuro (no en MVP): si se agregan organizaciones (compartir presupuestos en pareja), Clerk Organizations + columna `org_id` en tablas relevantes.

### Session management

- Clerk maneja sesiones via cookies httpOnly secure SameSite=Lax
- Refresh tokens automáticos
- MFA opcional (TOTP, SMS) — recomendado activar por default en producción

---

## 9. Build Order

**Este es el orden literal a seguir. Cada paso tiene una salida verificable.**

### Step 1: Scaffolding & base infra

```bash
pnpm create next-app@latest finanzia --typescript --tailwind --app --src-dir --import-alias "@/*"
cd finanzia
pnpm dlx shadcn@latest init -d
pnpm add motion @vercel/ai ai @ai-sdk/anthropic @ai-sdk/openai
pnpm add drizzle-orm postgres @clerk/nextjs
pnpm add @visx/scale @visx/shape @visx/group @visx/axis @visx/curve @visx/responsive
pnpm add dinero.js zod @hookform/resolvers react-hook-form zustand @tanstack/react-query nuqs next-themes
pnpm add papaparse @upstash/redis @upstash/ratelimit
pnpm add lucide-react sonner cmdk
pnpm add -D drizzle-kit tsx @types/papaparse
```

Configurar:
- `next.config.ts` con `experimental.viewTransition: true`
- `tsconfig.json` strict, `noUncheckedIndexedAccess: true`
- `tailwind.config` v4 (CSS-first) con design tokens en `globals.css`
- ESLint + Prettier
- `.env.example` con todos los keys
- `src/lib/env.ts` con Zod parsing al boot

**Salida**: app corre con `pnpm dev`, página vacía en `localhost:3000`.

### Step 2: Database — Supabase + Drizzle schema

1. Crear proyecto en Supabase (Region: us-east-1, password fuerte)
2. Habilitar extension `vector` en Database → Extensions
3. Conectar via Drizzle:
   - `src/lib/db/client.ts` con `postgres` driver pooled
   - `drizzle.config.ts` apuntando a `src/lib/db/schema.ts`
4. Escribir `src/lib/db/schema.ts` COMPLETO con todas las tablas de Sección 4
5. Generar migración: `pnpm drizzle-kit generate`
6. Aplicar: `pnpm drizzle-kit push` (dev) / `migrate` (prod)
7. Habilitar RLS en cada tabla con `user_id` + policy según Sección 4
8. Seed inicial de `categories` sistema (50 categorías estándar: Vivienda, Alimentación, Transporte, Salud, Educación, Entretenimiento, etc.) — script en `scripts/seed-categories.ts`

**Salida**: tablas existen en Supabase, `pnpm tsx scripts/seed-categories.ts` corre limpio.

### Step 3: Auth — Clerk + webhook sync

1. Crear app en Clerk, configurar proveedores (Email, Google, Apple)
2. Aplicar tema custom matcheando paleta Noir vía Clerk Elements / appearance prop
3. Wrap root layout con `<ClerkProvider>`
4. `middleware.ts` con `clerkMiddleware()` protegiendo `(app)/*`
5. Crear webhook endpoint `/api/webhooks/clerk/route.ts`:
   - Verificar firma Svix
   - On `user.created`: insertar en `users` + `profiles` con defaults
   - On `user.updated`: actualizar email/name
   - On `user.deleted`: soft delete (no destruir datos sin confirmación)
6. Configurar webhook URL en Clerk dashboard
7. Páginas: `/sign-in/[[...sign-in]]`, `/sign-up/[[...sign-up]]` con SignIn/SignUp components

**Salida**: signup completo crea usuario en DB; sign-in da acceso a `/`.

### Step 4: Design system — tokens, fonts, theme

1. `globals.css` con Tailwind v4 + design tokens:
   ```css
   @import "tailwindcss";

   @theme {
     --color-bg: #0A0A0B;
     --color-surface: #141416;
     /* ... resto de tokens de Sección 7 ... */
     --font-sans: 'Inter', system-ui, sans-serif;
     --font-mono: 'Geist Mono', monospace;
     --font-display: 'Inter Display', 'Inter', sans-serif;
     --font-editorial: 'Fraunces', Georgia, serif;
   }

   @media (prefers-color-scheme: light) { /* tokens claros */ }
   ```
2. `next/font` con Inter, Geist Mono, Fraunces — variable fonts
3. `next-themes` ThemeProvider con default `dark`, `enableSystem={true}`
4. Crear primitivos shadcn customizados: Button, Input, Card, Dialog, Sheet, Sonner, Command — ajustar a paleta y tokens
5. `src/lib/motion/easings.ts` y `durations.ts`
6. `src/lib/design/icons.ts` con whitelist curada de lucide
7. Storybook NO (over-engineering para MVP). En lugar de eso: ruta `/dev/styleguide` solo accesible en `NODE_ENV=development` mostrando paleta + tipografía + componentes — autoref para builder

**Salida**: `/dev/styleguide` muestra el sistema completo visible.

### Step 5: Layout principal — Rail + Cmd+K + View transitions

1. `src/app/(app)/layout.tsx`:
   - Header 56px con: logo wordmark "finanzia" (Geist Mono lowercase) + breadcrumb + avatar + theme toggle
   - Rail izquierda 56px con 5 iconos: Home, Transactions (arrows), Goals (target), Budgets (gauge), Accounts (wallet)
   - Main content con `view-transition-name: main`
2. `Cmd+K palette` (`src/components/app/command/`):
   - Trigger global: `Cmd/Ctrl+K` y `Cmd/Ctrl+Shift+P`
   - Vistas: `search` (default), `copilot` (cambia vista interna)
   - Items: navegación rápida + acciones rápidas + búsqueda semántica de transacciones (futura) + entrada al copiloto
   - Usar `cmdk` library
3. View Transitions API:
   - Configurar en `globals.css` según Sección 6
   - Wrapper component `<ViewTransition name="...">` en elementos compartidos
4. Toaster (sonner) configurado con design custom

**Salida**: navegar entre rutas tiene transición spatial; Cmd+K abre desde cualquier vista.

### Step 6: CRUD cuentas + transacciones (manual)

1. Página `/cuentas`:
   - RSC fetcheando cuentas del user
   - Cards con saldo actual (computado), tipo, currency
   - Botón "Nueva cuenta" → Sheet desde derecha
2. Server Actions `createAccount`, `updateAccount`, `archiveAccount`
3. Form de cuenta con React Hook Form + Zod
4. Componente `Amount` global (`src/components/app/amount/`):
   - Recibe `amount`, `currency`, `signed`, `size`, formatea con `Intl.NumberFormat` + `dinero.js`
   - Tabular nums, signo +/− sutil, tamaño hero opcional
5. Página `/movimientos`:
   - RSC con filtros (fecha, cuenta, categoría) en URL via nuqs
   - Tabla densa: fecha | descripción/merchant | categoría chip | monto
   - Búsqueda básica por description
   - Pagination cursor-based
6. Crear/editar transacción: overlay desde Cmd+N o ruta `/movimientos/nuevo`:
   - Campos: fecha (default hoy), cuenta, monto + currency selector, descripción, categoría, tags, notas
   - Si currency ≠ base: muestra preview de conversión
7. Server Action `createTransaction`:
   - Convierte a base currency usando `lib/currency/convert` (consulta cache `exchange_rates`)
   - Inserta. **NO** dispara categorización aún (eso viene en Step 9)

**Salida**: puedes registrar cuentas y transacciones a mano. Saldo se actualiza correctamente.

### Step 7: Categorías + presupuestos

1. Página `/ajustes/categorias`:
   - Lista jerárquica (parent → children)
   - Chips de color (paleta restrained: 8 colores muted curados — NO carnaval)
   - CRUD completo
2. Categoría asignable manual en form de transacción (combobox con `cmdk`)
3. Página `/presupuestos`:
   - Lista de presupuestos del mes actual
   - Por cada budget: nombre categoría, monto, gastado actual, % usado, barra ultra-minimalista (1.5px height, no glow)
4. Server Actions CRUD de budgets
5. Cálculo de "gastado": query agregado de transacciones del mes en esa categoría

**Salida**: el usuario puede definir presupuestos y verlos progresar.

### Step 8: Import CSV con mapping inteligente

1. Página `/import`:
   - Step 1: drop zone para .csv
   - Step 2: detecta columnas, sugiere mapping (fecha, monto, descripción, etc.) con heurística simple + opción de LLM call para mapeos ambiguos
   - Step 3: preview de primeras 20 filas con mapping aplicado, conversión a base currency
   - Step 4: confirmar → crea `import_batch` + dispara job en Trigger.dev
2. Trigger.dev job:
   - Parsea CSV completo con Papa Parse
   - Inserta transactions en batches de 100
   - Actualiza `import_batches.status` y `imported_rows`
3. UI poll del estado del batch via TanStack Query

**Salida**: import de archivo de banco real con N filas funciona y termina con cuenta consistente.

### Step 9: Auto-categorización con IA + embeddings

1. `src/lib/ai/client.ts` con Vercel AI SDK + Anthropic (Claude Sonnet 4.6)
2. `src/lib/ai/embeddings.ts` con OpenAI `text-embedding-3-small`:
   - Función `embedTransaction({ description, merchant, amount }) → vector(1536)`
3. **Trigger**: cada transacción nueva o updated dispara (via DB trigger o post-Server-Action):
   - Genera embedding y lo guarda en `transactions.embedding`
   - Llama `/api/ai/categorize` con el id
4. `/api/ai/categorize` pipeline (Sección 5):
   - Query top-5 transacciones similares del usuario via `embedding <=> $1`
   - Construye few-shot prompt
   - `generateObject` con Zod schema `{ categoryId, confidence, reason }`
   - Aplica si confidence ≥ 0.75
5. UI muestra chip "categorizado por Finanzia" (con `accent-ai` sutil) en transacciones con `ai_categorized=true` y `user_corrected=false`
6. Si user cambia categoría → marca `user_corrected=true`, este caso entra a few-shot prioritario en futuras categorizaciones

**Salida**: importar 100 transacciones nuevas categoriza ≥ 80% automáticamente.

### Step 10: Insights engine + cron diario

1. `src/lib/ai/insights.ts` — pipeline de generación:
   - Función `generateInsightsForUser(userId)`:
     - Agrega KPIs del mes corriente + 3 meses anteriores
     - Detecta anomalías z-score
     - Detecta forecast déficit
     - Llama Claude con `generateObject` schema de `Insight[]` (máx 3)
     - Inserta en DB
2. `/api/cron/insights` route:
   - Verifica `Authorization: Bearer ${CRON_SECRET}`
   - Itera usuarios activos en batches
3. Configurar cron en `vercel.json`:
   ```json
   {
     "crons": [
       { "path": "/api/cron/insights", "schedule": "0 11 * * *" },
       { "path": "/api/cron/recurring", "schedule": "0 6 * * *" },
       { "path": "/api/cron/exchange-rates", "schedule": "0 5 * * *" }
     ]
   }
   ```
4. UI `InsightCard` (`src/components/app/insight-card/`):
   - Tipografía editorial sutil — body en Inter 14px, action en Inter 13px medium
   - Background: `accent-ai-subtle`, border `accent-ai/30`
   - Acciones: "Hecho" (act) | "Recordar después" (snooze) | dismiss (x sutil)
   - Stagger entrance animation
5. Stack de insights en `/` (Home) muestra top 3 unread, link a `/insights` para ver todos

**Salida**: al día siguiente del primer uso, aparecen insights reales en home. Al accionar uno, se ejecuta su `action.payload`.

### Step 11: Copiloto Finanzia con tool-calling

1. `src/lib/ai/tools/` define cada tool con Zod schema + handler
2. `/api/ai/chat/route.ts`:
   - Usa `streamText` del AI SDK con system prompt en español
   - Tools listadas en Sección 5
   - Modelo: Claude Sonnet 4.6
3. UI del copiloto (`src/components/copilot/`):
   - Vive dentro del Cmd+K (vista "copilot")
   - Cmd+K → tab "Pregúntale a Finanzia"
   - Input textarea + send (Enter envía, Shift+Enter newline)
   - Mensajes con streaming (`useChat` hook del AI SDK)
   - Tool results renderizados como cards inline (no JSON crudo)
   - **Tool calls que mutan**: renderizar `<ToolConfirmation>` que requiere confirmación del usuario (botón "Confirmar" / "Cancelar") antes de ejecutar Server Action real
4. System prompt en `src/lib/ai/prompts/copilot.ts`:
   - Contexto del usuario (nombre, base currency, locale, perfil financiero)
   - Reglas: "Eres Finanzia. Conciso, profesional, nunca usas emojis. Hablas en español. Nunca inventas cifras. Si necesitas datos, usa las herramientas. Cuando propongas cambios, requieres confirmación explícita."

**Salida**: abrir Cmd+K → "¿Cuánto gasté en restaurantes este mes?" → respuesta con cifra real. "Crea un presupuesto de 800k en restaurantes" → muestra confirmación → user confirma → budget creado.

### Step 12: Metas, recurring, tarjetas de crédito, alertas, deploy

1. Página `/metas`:
   - Cards de metas con progreso (no barra ñ — usar diseño editorial: monto actual / target en Geist Mono grande, microbarra debajo)
   - CRUD goals + linked_account opcional
2. Recurring rules:
   - Página `/ajustes/recurring` (o dentro de `/movimientos` como sub-vista)
   - Job `/api/cron/recurring` crea transacciones cuando `next_run = today` y `auto_create=true`
3. Credit cards:
   - Si account.type=`credit_card`, mostrar tarjeta con saldo, límite, % usado, próximo corte/pago
   - Alerta cuando faltan 3 días para pago
4. Alerts:
   - Trigger al crear transacción: si excede budget o si gasto inusual (>2x media histórica de la categoría en esa semana) → insertar `alerts` row
   - UI: badge sutil en rail (numerito sin color, solo dot en `accent-ai`) → click abre lista
5. Estados vacíos editoriales en cada página:
   - Headline en `Fraunces` italic + body Inter + sin ilustración
6. Polish:
   - Skeletons en todo loading state
   - Error boundaries con copy editorial
   - Empty states verificados
   - Lighthouse audit ≥ 95 todos
7. Deploy:
   - Conectar repo a Vercel
   - Configurar todas las env vars en Vercel
   - Conectar dominio (si aplica)
   - Habilitar Sentry
   - Habilitar Vercel Analytics
   - Smoke test en producción

**Salida**: Finanzia v1 en producción, accesible, estable, premium.

---

## 10. Environment Setup

### Prerequisites

- Node.js 22+ (LTS)
- pnpm 9+
- Cuenta Supabase
- Cuenta Clerk
- Cuenta Vercel
- API key Anthropic (Claude)
- API key OpenAI (solo para embeddings — alternativa: usar Voyage embeddings via Anthropic)
- Cuenta Upstash (Redis)
- Cuenta Trigger.dev (free tier suficiente para MVP)
- Cuenta Sentry (free tier)

### Environment Variables

Validadas en `src/lib/env.ts` con Zod — la app no inicia si falta alguna.

| Variable | Descripción | Dónde obtener |
|----------|-------------|---------------|
| `NEXT_PUBLIC_APP_URL` | URL pública (http://localhost:3000 en dev) | — |
| `DATABASE_URL` | Postgres connection string (pooler) | Supabase → Settings → Database → Connection pooler |
| `DIRECT_URL` | Postgres directo (para migraciones) | Supabase → Settings → Database → Direct connection |
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Anon key (RLS) | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server only, bypassa RLS) | Supabase → Settings → API |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk pub key | Clerk → API Keys |
| `CLERK_SECRET_KEY` | Clerk secret | Clerk → API Keys |
| `CLERK_WEBHOOK_SECRET` | Svix secret del webhook | Clerk → Webhooks |
| `ANTHROPIC_API_KEY` | Claude API key | console.anthropic.com |
| `OPENAI_API_KEY` | Solo para embeddings | platform.openai.com |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis URL | upstash.com |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis token | upstash.com |
| `TRIGGER_API_KEY` | Trigger.dev API key | trigger.dev |
| `TRIGGER_API_URL` | Trigger.dev endpoint | trigger.dev |
| `EXCHANGE_RATE_API_KEY` | API key de exchangerate.host (si paid) | exchangerate.host |
| `SENTRY_DSN` | Sentry project DSN | sentry.io |
| `CRON_SECRET` | Secret aleatorio para auth de crons | `openssl rand -hex 32` |

### Setup commands

```bash
git clone <repo> && cd finanzia
pnpm install
cp .env.example .env.local
# Llenar .env.local con valores reales

# Database
pnpm drizzle-kit generate
pnpm drizzle-kit push
pnpm tsx scripts/seed-categories.ts

# Dev
pnpm dev
```

---

## 11. Dependencies

### Core

| Paquete | Propósito |
|---------|-----------|
| next | Framework |
| react, react-dom | UI |
| typescript | Lenguaje |
| tailwindcss | Estilos |
| @clerk/nextjs | Auth |
| drizzle-orm, postgres | DB |
| zod | Validación |
| ai, @ai-sdk/anthropic, @ai-sdk/openai | LLM + embeddings |
| motion | Animaciones |
| @visx/* | Charts |
| dinero.js | Aritmética monetaria |
| react-hook-form, @hookform/resolvers | Forms |
| zustand | Estado UI |
| @tanstack/react-query | Datos vivos cliente |
| nuqs | URL state |
| next-themes | Theme |
| cmdk | Command palette |
| sonner | Toasts |
| lucide-react | Iconos |
| papaparse | CSV parse |
| @upstash/redis, @upstash/ratelimit | Cache + rate limit |
| @trigger.dev/sdk | Background jobs |
| @sentry/nextjs | Errores |

### Dev

| Paquete | Propósito |
|---------|-----------|
| drizzle-kit | Migraciones |
| tsx | Scripts TS |
| eslint, @next/eslint-config-next | Lint |
| prettier, prettier-plugin-tailwindcss | Formato |
| @types/* | Types |

---

## 12. Deployment Strategy

### Hosting

**Vercel**, plan Pro recomendado para producción (cron + edge + analytics + ai gateway).

Configuración:
- `next.config.ts` con `experimental.viewTransition: true`
- Build command: `pnpm build`
- Output: standalone
- Region: `iad1` (us-east-1, cerca de Supabase default)

### CI/CD

- Preview deploys automáticos en cada PR
- Production deploy en merge a `main`
- Pre-commit hook: `pnpm lint && pnpm typecheck` (via `lint-staged` + `husky`)
- GitHub Action opcional para correr tests en CI

### Domains

- MVP: `finanzia.vercel.app` o subdominio
- Producción real: comprar dominio propio (sugerencia: `finanzia.app` o `usefinanzia.com`)
- Configurar DNS en Vercel

### Environments

| Env | URL | DB | Clerk |
|-----|-----|-----|-------|
| Dev | localhost | Supabase project "finanzia-dev" | Clerk "Development" |
| Preview | *.vercel.app por PR | Supabase project "finanzia-staging" (mismo schema, datos seed) | Clerk "Development" |
| Production | finanzia.app | Supabase project "finanzia-prod" | Clerk "Production" |

**Crítico**: cada environment tiene su propio `CLERK_WEBHOOK_SECRET` y URL de webhook. Configurar 3 webhooks en Clerk apuntando a las URLs respectivas.

---

## 13. Testing Strategy

### Unit tests (Vitest)

- `src/lib/currency/format.test.ts` — formato de montos
- `src/lib/currency/convert.test.ts` — conversiones con tasas
- `src/lib/csv/mapping.test.ts` — detección de columnas
- `src/lib/ai/insights.test.ts` — anomaly detection puro (sin LLM call real)
- Cualquier helper en `src/lib/utils.ts`

### Integration tests (Vitest + msw para LLM)

- Server Actions críticas: `createTransaction`, `createBudget`, `dismissInsight`
- Pipeline de categorización (mockeando LLM call con MSW)
- Webhook de Clerk (verificación de firma + sync)

### E2E tests (Playwright)

- **Flujo crítico 1**: Signup → onboarding → crear cuenta → crear transacción → ver en home
- **Flujo crítico 2**: Import CSV de prueba → preview → confirmar → transactions aparecen
- **Flujo crítico 3**: Abrir Cmd+K → preguntar al copiloto → recibir respuesta
- Correr en CI antes de prod deploy

### No testar

- Estilos visuales (chromatic/percy = over-engineering MVP)
- Componentes UI puros sin lógica

---

## 14. Skills to Use During Build

| Skill | Cuándo usar | Por qué |
|-------|-------------|---------|
| `/ui-ux-pro-max` | Step 4 (design system) y Step 5 (layout) | Refinar paleta, tipografía, micro-decisiones visuales contra la base ya definida en este blueprint. **Pasarle el "Mandato Estético" de Sección 0 como contexto previo a cualquier consulta.** |
| `/shadcn-ui` | Step 1, 4 | Setup y customización de primitivos shadcn |
| `/frontend-design` | Steps 5, 6, 10, 11 | Diseñar layouts, insight cards, copiloto UI — pero siempre validando contra Mandato Estético |
| `/playwright-cli` | Step 13 | E2E tests |
| `/seo-audit` | Pre-deploy (futuro cuando exista landing pública) | Auditoría SEO |
| `/deep-research` | Cualquier punto donde haya duda técnica | Comparar approaches con datos actualizados |

**Regla crítica para usar `/ui-ux-pro-max`**: la skill ofrece 161 paletas y 57 font pairings. NO escoger ninguna que viole el Mandato Estético. La paleta de este blueprint (Finanzia Noir) es el punto de partida — la skill se usa para refinarla, no para reemplazarla con un template colorido. Si la skill sugiere algo que se siente "AI dashboard genérico", rechazar y mantener Noir.

---

## 15. CLAUDE.md for Target Project

Copiar el siguiente contenido tal cual al archivo `CLAUDE.md` en la raíz del proyecto `finanzia/`:

```markdown
# Finanzia

Webapp de finanzas personales con IA — multi-tenant ready, single-user MVP. Núcleo en español, COP/USD multi-divisa.

## Commands

- `pnpm dev` — Dev server
- `pnpm build` — Production build
- `pnpm lint` — ESLint
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test` — Vitest
- `pnpm test:e2e` — Playwright
- `pnpm drizzle-kit generate` — Generar migración
- `pnpm drizzle-kit push` — Aplicar schema dev
- `pnpm drizzle-kit migrate` — Aplicar migraciones prod
- `pnpm tsx scripts/seed-categories.ts` — Seed categorías sistema

## Tech Stack

Next.js 16 (App Router) + TypeScript strict + Tailwind v4 + shadcn/ui + Supabase Postgres + Drizzle + Clerk + Vercel AI SDK (OpenAI `gpt-5.4-mini` copiloto + embeddings; Claude Sonnet 4.6 en fallback de categorización e insights) + Visx + Motion + Vercel.

## Architecture

### Directory Structure

- `src/app/(app)/` — App autenticada (protegida por middleware Clerk)
- `src/app/(marketing)/` — Reservada para landing pública futura
- `src/app/api/` — Webhooks, AI routes, crons
- `src/components/ui/` — shadcn primitivos customizados al sistema Noir
- `src/components/app/` — Componentes de dominio (rail, command, insight-card, amount, chart)
- `src/components/copilot/` — Copiloto Finanzia (Cmd+K → IA)
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

**Anti-dashboard genérico. Anti-AI-template colorido.** Premium fintech, editorial, minimalista. Referencias: Linear, Mercury, Arc, Raycast, Stripe Dashboard. Cero emojis. Cero gradientes. Cero glow. Cero ilustraciones 3D. Tipografía como protagonista — los números son los héroes. Color restrained, casi monocromático. Acento único `#B8A6F5` solo para presencia de IA.

### Colors (dark — default)

- `bg` #0A0A0B · `surface` #141416 · `surface-elevated` #1C1C1F · `surface-hover` #222226
- `border` #26262A · `border-emphasis` #34343A
- `text` #FAFAFA · `text-secondary` #A1A1A8 · `text-tertiary` #6B6B72
- `accent-ai` #B8A6F5 (único acento — solo para IA)
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
6. **El LLM nunca muta datos sin confirmación UI.** Tool calls que mutan retornan propuesta; usuario confirma; entonces Server Action ejecuta.
7. **RLS habilitada en toda tabla con `user_id`.** Sin excepciones.
8. **Todo lo público del cliente puede leer datos solo via anon key + RLS** — la `service_role_key` jamás se expone al cliente.
9. **TypeScript strict, `noUncheckedIndexedAccess: true`, sin `any`.** Si un tipo es difícil, usa `unknown` + narrowing, no `any`.
10. **Tipografía: números siempre Geist Mono tabular.** Sin excepciones.
11. **View Transitions habilitadas para toda navegación `(app)/*`.**
12. **`prefers-reduced-motion: reduce` respetado en toda animación.**
13. **Mandato Estético Sección 0 del blueprint es ley.** Cualquier sugerencia de skill externa (incluida `/ui-ux-pro-max`) que viole el mandato se rechaza.
14. **Empty states son una oportunidad editorial, no un bug a ocultar.** Tipografía Fraunces, body Inter, sin ilustración.
15. **Cuando dudes entre dos diseños, elige el que parezca más caro, no el que parezca más amigable.**
```

---

## 16. Reglas No Negociables del Builder

1. **Lee la Sección 0 (Mandato Estético) antes de escribir cualquier componente visual.** Si una decisión de UI/UX la viola, detente.
2. **No introduzcas frameworks, librerías ni dependencias** no listadas sin justificación explícita (tamaño bundle, alternativa documentada).
3. **No sustituyas Drizzle por Prisma, ni Clerk por NextAuth, ni Sonnet por GPT** — las decisiones fueron deliberadas. Si crees que hay razón fuerte para cambiar, documenta y pregunta al usuario.
4. **No inventes campos en la DB.** Si necesitas un campo nuevo, primero actualiza `src/lib/db/schema.ts`, genera migración, actualiza tipos, luego úsalo.
5. **No skipees Step 4 (Design System).** Construir UI sin el sistema definido produce el "AI dashboard plano" que el usuario rechazó explícitamente.
6. **Sigue Build Order literalmente.** Cada step depende del anterior. Saltarse pasos = deuda técnica inmediata.
7. **Cuando uses `/ui-ux-pro-max` u otra skill, pasa siempre el Mandato Estético como restricción previa.** Las sugerencias deben respetarlo.
8. **No instales emojis ni iconos coloridos** "para alegrar la UI". La UI no necesita alegrarse — necesita comunicar precisión.
9. **Toda copy en español.** Tono profesional, claro, sin signos de exclamación, sin "¡Genial!" ni "¡Listo!". Confirmaciones secas: "Hecho.", "Guardado."
10. **Antes de marcar el MVP como completo, verifica todos los criterios de la Sección 1.3 (Success Metrics).** Si Lighthouse < 95 o auto-cat < 85% post-30-días-uso simulado, no está terminado.

---

## Notas finales

- **Belvo Open Banking (v2):** la arquitectura ya está lista. Cuando llegue el momento, crear `src/lib/integrations/belvo/` siguiendo el adapter pattern. Las cuentas conectadas marcan `accounts.source='belvo'`. Sincronización vía webhook + cron. No requiere reescribir nada.
- **OCR de tickets (v2):** integrar con Anthropic Vision (Claude Sonnet 4.6 acepta imágenes). Endpoint `/api/ai/ocr/transaction` que recibe foto, devuelve `{ merchant, amount, currency, date, suggestedCategory }`.
- **Inversiones (v2):** tabla `holdings` con `account_id`, `symbol`, `quantity`, `cost_basis`. Integrar con Alpaca o similar para precios. Fuera de scope MVP.
- **Notificaciones email (v2):** Resend + templates en `src/lib/email/`. Trigger desde insights críticos.
- **Compartir presupuestos en pareja (v2):** Clerk Organizations + columna `org_id`.

El blueprint es completo. Puede usarse como única fuente de verdad para construir Finanzia desde cero.
