# Finanzia — Plan IA v2 (Reorganización + Refinamiento Profundo)

> Documento canónico iniciado 2026-05-28. Fuente de verdad para el siguiente
> sprint de la app. Si este archivo contradice cualquier comentario suelto
> en otro lado, **gana este archivo**.
>
> El blueprint (`docs/finanzia-blueprint.md`) sigue siendo verdad para
> conceptos de dominio; este doc gobierna estructura, navegación y UX.

---

## 0. Resumen ejecutivo

La app llegó a **18 destinos top-level** sumando subrutas de `/ajustes`.
Eso satura — incluso al creador (Daniel) le genera incomodidad. La causa
raíz: se construyó por features, no por intenciones del usuario. Resultado:
overlaps conceptuales, niveles mezclados (acciones puntuales como rutas,
metadata administrativa como sección), tarjetas escondidas dentro de
"cuentas genéricas".

**Solución**: colapsar a **4 secciones posesivas + Ajustes**, organizar las
funcionalidades como sub-tabs dentro de cada una, eliminar/fusionar
redundancias, y pulir el copy + empty states + densidad de cada vista.

**Resultado esperado**: el usuario abre la app y sabe **inmediatamente** dónde
buscar. Sin pensar. Sin navegar tres veces. Sin scroll exploratorio.

---

## 1. Diagnóstico

### 1.1 Inventario actual (18 destinos)

| Tipo | Rutas |
|---|---|
| Top-level visible | `/dashboard`, `/cuentas`, `/transacciones`, `/deudas`, `/importar`, `/categorias`, `/presupuestos`, `/metas`, `/ahorro`, `/cash-flow`, `/insights`, `/informes`, `/ajustes` |
| Sub-ajustes que aparecen en mobile nav | `/ajustes/perfil-financiero`, `/ajustes/integraciones` (IA), `/ajustes/integraciones-bancarias`, `/ajustes/recurring`, `/ajustes/alertas` |

### 1.2 Síntomas concretos

| Síntoma | Ejemplo | Problema raíz |
|---|---|---|
| Overlap conceptual | `/ahorro` + `/cash-flow` + `/informes` son todos "mirar al dinero en el tiempo" | El usuario no sabe en cuál mirar |
| Overlap conceptual | `/insights` + `/informes` son ambos "qué pasó / qué noto" | Dos contenedores para la misma idea |
| Overlap conceptual | `/presupuestos` + `/metas` son ambos "qué quiero / qué límite pongo" | Distinción es real pero hoy no está visualmente integrada |
| Nivel mezclado | `/importar` es una acción puntual, no una sección | Vive en sidebar permanente |
| Nivel mezclado | `/categorias` es metadata administrativa | Top-level cuando debería estar en ajustes |
| Nivel mezclado | `/ajustes/recurring` es central al plan financiero | Enterrado en ajustes |
| Mental model | Tarjetas viven en `/cuentas` junto a corrientes | El usuario no piensa "tarjeta = cuenta", piensa "tarjeta = cosa con cupo, corte, intereses, cuotas" |
| Saturación visual | Cada feature creció con su propia página | Densidad no se balancea entre vistas |

### 1.3 Lo que se hizo bien (no tocar)

- Sistema de diseño Noir está coherente (tokens, tipografía, espaciado)
- El data layer es limpio (multi-divisa, RLS, queries en `lib/db/queries/`)
- El copiloto y los detectores de insights funcionan bien por debajo
- Performance está optimizada (prefetch, region pinning, lazy dialogs)

---

## 2. Decisiones arquitectónicas (no re-discutir)

| Decisión | Razón |
|---|---|
| **4 secciones posesivas** + Ajustes | Reduce 18→4 destinos visibles. Posesivo conecta emocionalmente. |
| Sección **"Mi dinero"** dedicada con tab **"Tarjetas"** propio | Tarjetas necesitan visibilidad first-class sin mover el data model |
| **NO mover** `accounts.type='credit_card'` a `debts` | Data model sigue limpio. Sólo cambia la presentación. |
| `/importar` deja de ser ruta — vive como acción dentro de Movimientos | Es acción puntual, no destino |
| `/categorias` deja de ser top-level — vive en Ajustes | Es metadata administrativa |
| `/ajustes/recurring` se eleva a sub-tab de **Mi plan** | Recurrentes son herramienta de planeación, no configuración |
| Ajustes se convierte en **una sola página con secciones internas** (no sub-rutas) | Hoy son 4 sub-páginas que aparecen en mobile nav y saturan |
| Las sub-tabs viven como **URL segments** (`/mi-dinero/tarjetas`) no como query params | Linkeable, navegable con back, indexable |
| El `<h1>` de cada sección es el **título posesivo + sub-tab** ("Mi dinero · Tarjetas") | Breadcrumb implícito |
| Cmd+K mantiene atajos directos a sub-tabs | "Ir a tarjetas" debe seguir funcionando como antes |

---

## 3. Nueva Información Arquitecture (IA)

### 3.1 Estructura final

```
Hoy             /dashboard
└ Saldo + lo del día + próxima cosa a hacer

Mi dinero       /mi-dinero  (redirect → /mi-dinero/cuentas)
├ Cuentas       /mi-dinero/cuentas
├ Tarjetas      /mi-dinero/tarjetas      ← NUEVO, sección propia
├ Deudas        /mi-dinero/deudas
└ Movimientos   /mi-dinero/movimientos   (incluye CTA "Importar CSV")

Mi plan         /mi-plan  (redirect → /mi-plan/presupuestos)
├ Presupuestos  /mi-plan/presupuestos
├ Metas         /mi-plan/metas
├ Ahorro        /mi-plan/ahorro
├ Cash flow     /mi-plan/cash-flow
└ Recurrentes   /mi-plan/recurrentes

Mi historia     /mi-historia  (redirect → /mi-historia/insights)
├ Insights      /mi-historia/insights
└ Informes      /mi-historia/informes

Ajustes         /ajustes  (página única con tabs internos)
├ Perfil
├ Categorías
├ Recurrentes
├ Integraciones bancarias (email)
├ Integraciones IA
├ Alertas
└ Apariencia / Sesión
```

### 3.2 Mapeo viejo → nuevo

| Ruta vieja | Ruta nueva | Acción |
|---|---|---|
| `/dashboard` | `/dashboard` | Sin cambio de ruta; refinar contenido |
| `/cuentas` | `/mi-dinero/cuentas` | Mover; mantener redirect 301 desde `/cuentas` |
| `/cuentas/[id]` | `/mi-dinero/cuentas/[id]` | Mover; redirect |
| `/transacciones` | `/mi-dinero/movimientos` | Mover + renombrar; redirect |
| `/transacciones?day=` | `/mi-dinero/movimientos?day=` | Mantener query param |
| `/deudas` | `/mi-dinero/deudas` | Mover; redirect |
| `/importar` | (eliminada — CTA en `/mi-dinero/movimientos`) | Redirect a `/mi-dinero/movimientos?import=open` |
| (nueva) | `/mi-dinero/tarjetas` | Vista filtrada de `accounts.type='credit_card'` con UX dedicada |
| `/presupuestos` | `/mi-plan/presupuestos` | Mover; redirect |
| `/metas` | `/mi-plan/metas` | Mover; redirect |
| `/ahorro` | `/mi-plan/ahorro` | Mover; redirect |
| `/cash-flow` | `/mi-plan/cash-flow` | Mover; redirect |
| `/ajustes/recurring` | `/mi-plan/recurrentes` | Mover (eleva de configuración a plan); redirect |
| `/insights` | `/mi-historia/insights` | Mover; redirect |
| `/informes` | `/mi-historia/informes` | Mover; redirect |
| `/informes/[period]` | `/mi-historia/informes/[period]` | Mover; redirect |
| `/categorias` | `/ajustes#categorias` (anchor en página única) | Mover a tab dentro de ajustes |
| `/ajustes/perfil-financiero` | `/ajustes#perfil` | Tab interno |
| `/ajustes/integraciones-bancarias` | `/ajustes#integraciones-bancarias` | Tab interno |
| `/ajustes/integraciones` | `/ajustes#integraciones-ia` | Tab interno (rename para distinguir) |
| `/ajustes/alertas` | `/ajustes#alertas` | Tab interno |

### 3.3 Navegación por dispositivo

**Desktop sidebar** (4 grupos):
```
[Logo]
─────
Hoy
─────
Mi dinero
Mi plan
Mi historia
─────
[Ajustes — footer]
[User button — footer]
```

Cuando estás en `/mi-dinero/*`, "Mi dinero" se marca activo y se expande
mostrando las sub-tabs verticalmente como sub-items.

**Mobile bottom-nav** (4 botones):
```
[Hoy] [Mi dinero] [Mi plan] [Más]
```

"Más" abre sheet con: Mi historia + Ajustes. (Mi historia es menos frecuente
en mobile.)

Al estar dentro de una sección, la parte superior muestra **tabs horizontales
scrollables** con las sub-secciones. Misma idea que Apple Wallet o Mercury mobile.

**Topbar titles** se reconstruyen del path:
- `/mi-dinero/tarjetas` → "Mi dinero · Tarjetas"
- `/mi-plan/cash-flow` → "Mi plan · Cash flow"

---

## 4. Refinamiento por sección

### 4.1 Hoy (`/dashboard`)

**Mantener:**
- Hero del saldo total (multi-divisa, display gigante)
- "Tus cuentas" condensado (grid 6 max)
- "Últimos movimientos" (5)

**Cambiar:**
- Quitar `CategoryBreakdown` del dashboard — saturaba. Migrar a `/mi-historia` (es más retrospectivo).
- `DebtsSummaryCard` queda pero condensar a 1 línea con CTA "Ver deudas"
- `CashFlowTeaser` (creado en sprint anterior) queda — es exactamente el tipo de info para "hoy"
- `BudgetProgressCard` máx 2 (los más críticos), no 4
- "Lecturas recientes" (insights): máx 2

**Idea nueva opcional**: bloque "Lo de hoy" arriba que cambie según la hora:
- Mañana (5-11am): "3 cosas próximas esta semana" + recordatorio recurrente que cae mañana
- Tarde (12-18pm): "Lo que pasó hoy" — movimientos del día + delta
- Noche (19-23pm): "Mañana viene…" + recordatorios

**Empty state**: cuando no hay nada, una sola frase editorial Fraunces grande, sin grid vacío de cards.

### 4.2 Mi dinero (`/mi-dinero/*`)

#### 4.2.1 Cuentas (`/mi-dinero/cuentas`)

**Mantener:** layout actual de cards con saldo + balance + utilización para crédito.

**Cambiar:**
- Excluir tarjetas (ahora viven en `/mi-dinero/tarjetas`). Sólo mostrar checking/savings/cash/investment/crypto/other.
- Agregar "patrimonio neto" como header KPI (suma de cuentas + tarjetas + activos − deudas) en moneda base.

#### 4.2.2 Tarjetas (`/mi-dinero/tarjetas`) — **NUEVO**

Vista first-class para `accounts.type='credit_card'`.

**Hero:** "Deuda total en tarjetas" (suma de balances negativos en base currency).

**Lista:** una card por tarjeta con:
- CardVisual prominente (340px max)
- Nombre + últimos 4
- Saldo (deuda) + cupo + utilización bar
- Próximo corte / próximo pago en dias
- Botón "Detalle" → `/mi-dinero/cuentas/[id]` (mantiene detalle existente)

**Encima de la lista:** mini stats:
- Cupo total disponible (suma de cupos − suma de usado)
- Utilización promedio ponderada
- Próximo corte más cercano

**Empty state:** "Aún no registraste ninguna tarjeta. Agrega una para ver cupos, cortes y simular compras." + CTA → "Nueva tarjeta" (abre NewAccountDialog con tipo pre-seleccionado).

**Imágenes de tarjetas**: hoy `/public/cards/` está vacío. El plan de imágenes:
1. Drop manual de 8-12 AVIF para los bancos top (Bancolombia, Davivienda, Nu, BBVA…) — pendiente del usuario
2. Mientras tanto, placeholder mejorado: en vez de logo genérico, render del **nombre del banco** en tipografía Sora (consistente con brand) sobre gradiente sutil del color del banco
3. Post-MVP: motor de búsqueda Brave + Vision (Fase 4b del roadmap original, requiere API keys)

#### 4.2.3 Deudas (`/mi-dinero/deudas`)

**Mantener:** página actual (tabla `debts` para préstamos/hipotecas).

**Cambiar:**
- Header: agregar contexto "Préstamos, hipotecas y otras deudas no-tarjeta. Las tarjetas viven en Tarjetas."
- KPI hero: deuda total (suma de `debts` + tarjetas, en base currency)
- Cada item: progreso visual de amortización si hay plan

#### 4.2.4 Movimientos (`/mi-dinero/movimientos`)

**Mantener:** tabla desktop + lista mobile.

**Cambiar:**
- "Importar CSV" es **botón en el header** (no ruta). Abre dialog inline.
- Filtros: hoy son 4 tabs (Todas/Gastos/Ingresos/Transferencias) — agregar **filtros guardados** (chips): "Sin categorizar", "Este mes", "Tarjetas", "Última semana"
- Vista diaria (`?day=…`) ya existe pero es invisible → agregar **date picker compacto** en el header que la activa
- Densidad: revisar row height en mobile, podría ser más compacta (44px → 56px hoy)

### 4.3 Mi plan (`/mi-plan/*`)

#### 4.3.1 Presupuestos (`/mi-plan/presupuestos`)

**Mantener:** lista de presupuestos con progreso.

**Cambiar:**
- Hero: "% del mes consumido" (cuántos días llevamos del mes × 100/30) vs "% del gasto presupuestado consumido" como comparación. Pone el ritmo en perspectiva.
- Empty state editorial: "Un presupuesto es la pista que le pones a una categoría. Sin pistas, el dinero se va por donde quiera."

#### 4.3.2 Metas (`/mi-plan/metas`)

**Mantener:** lista de metas con progreso.

**Cambiar:**
- **Fusionar conceptualmente con Ahorro**: una meta de ahorro debería poder vincularse con el plan activo de `/mi-plan/ahorro`
- Tipos claros: "Acumular X para Y", "Reducir gasto en Z categoría", "Pagar deuda W"
- Cada meta puede tener una **fecha objetivo** y la app calcula ritmo necesario

#### 4.3.3 Ahorro (`/mi-plan/ahorro`)

**Mantener:** hero + bar chart + forecast.

**Cambiar:**
- Si hay metas activas en `/mi-plan/metas`, mostrar **cuánto del ahorro va a cuál meta** (allocation)
- Link "Cambiar plan" hoy va a `/ajustes/perfil-financiero` — cambiar a un dialog inline (no salir del flow)

#### 4.3.4 Cash flow (`/mi-plan/cash-flow`)

**Mantener:** estado actual está bien.

**Cambiar:**
- Tooltip explicativo de la banda ±1σ (hoy el copy está abajo, podría ser hover sobre la banda)
- Eventos próximos: hoy se agrupan por día — agrupar por **semana** si son muchos

#### 4.3.5 Recurrentes (`/mi-plan/recurrentes`)

**Mantener:** lista + drift timeline.

**Cambiar:**
- Header: explicar que las recurrentes alimentan el cash flow + recordatorios + drift detection
- Agregar **agrupación por tipo**: Ingresos / Gastos fijos / Suscripciones (autocategorizar suscripciones como subset de gastos)
- "Procesar vencidas" debería ser menos prominente — es admin

### 4.4 Mi historia (`/mi-historia/*`)

#### 4.4.1 Insights (`/mi-historia/insights`)

**Mantener:** lista actual.

**Cambiar:**
- Agrupar por **mes** (insights de noviembre, de octubre…)
- Cada insight: mostrar **acción tomada o desestimada**
- Editorial intro: "Lo que Finanzia notó por ti" en Fraunces italic

#### 4.4.2 Informes (`/mi-historia/informes/*`)

**Mantener:** layout actual del informe mensual (lo dejamos editorial en la última pasada).

**Cambiar:**
- Lista (`/mi-historia/informes`): timeline editorial vertical con meses en Fraunces
- Detalle: incluir **CategoryBreakdown** del mes (migrado desde dashboard)
- Linkear de cada insight a su informe del mismo mes y viceversa

**Considerar (decisión a tomar en sesión)**: ¿fusionar Insights e Informes en una sola vista cronológica? Insights = micro-events, Informes = macro-summaries del mes. Visualmente coherentes en una sola línea de tiempo. Pero también puede saturar. **Mi recomendación: mantener separados al menos por ahora**, ver uso real.

### 4.5 Ajustes (`/ajustes`)

**De 5 sub-páginas a 1 página con secciones internas (anchors).**

Layout: sidebar interno + contenido a la derecha. En mobile: lista vertical de secciones que expanden.

Secciones internas:
1. **Perfil** (lo de `/ajustes/perfil-financiero`)
2. **Categorías** (lo de `/categorias`, hoy top-level)
3. **Integraciones bancarias** (email inbox)
4. **Integraciones IA** (lo de `/ajustes/integraciones`)
5. **Alertas**
6. **Apariencia** (dark/light theme, idioma futuro)
7. **Sesión** (Clerk user button, logout, danger zone)

---

## 5. Cross-cutting improvements

### 5.1 Copy global

- Reescribir títulos H1 de cada sección para que sean **una frase honesta**, no descripción técnica
- Empty states siempre con la misma estructura: 1 frase editorial Fraunces + 1 párrafo de contexto + 1 CTA
- Eliminar el uso de "Sin movimientos" "Sin datos" "Sin nada" como copy literal — usar editorial: "Aún no hay nada que mostrar aquí. {contexto}"

### 5.2 Espaciado y ritmo

- `gap-10 lg:gap-12` entre secciones de página: **regla durísima**, revisar todas las páginas
- `gap-4` dentro de una section: **regla**
- Padding de cards: `p-5` default, `p-6` para cards-héroe, `p-4` para listas internas
- Eliminar todos los `gap-8` que sobreviven (inconsistentes)

### 5.3 Patrón de breadcrumb

Cuando estás en sub-tab o sub-detalle:
```
← Mi dinero / Tarjetas
```
Como mini-link arriba del H1, no como componente Breadcrumb pesado.

### 5.4 Cmd+K

Mantener atajos directos:
- "Ir a tarjetas" → `/mi-dinero/tarjetas`
- "Ir a presupuestos" → `/mi-plan/presupuestos`
- "Resumen del día" → `/mi-dinero/movimientos?day=YYYY-MM-DD`
- "Nueva tarjeta" → abre NewAccountDialog con tipo `credit_card` pre-seleccionado
- "Analizar compra" → abre dialog del PurchaseAnalyzer (extraído como standalone)
- "Preguntar a Finanzia" → abre Copilot

### 5.5 Mobile

- Bottom-nav 4 botones (Hoy / Mi dinero / Mi plan / Más)
- Tabs internos como horizontal scroll bajo el topbar
- Touch targets siempre ≥44px
- Padding inferior extra en páginas con bottom-nav (`pb-20`)

### 5.6 Empty states sistematizados

Crear `<EmptyState>` component variante "rich" con:
- Headline (Fraunces italic, ~2xl)
- Body (Inter, max-w-prose)
- Action slot
- Icon opcional pero **sutil** (size 32-40px, stroke 1.5, color text-tertiary)

### 5.7 Accesibilidad

- Tab order coherente en cada vista
- aria-current="page" en tabs activos
- aria-live para confirmaciones de toast (ya lo hace sonner)
- Skip-link "Ir al contenido" desde topbar (no existe hoy)

---

## 6. Plan de migración (por fases ejecutables)

### Fase A — Cimientos de IA (1 sesión) ✅ `316d70f`

**Objetivo:** estructura de rutas nueva funcionando con redirects desde las viejas.

1. Crear directorios `/mi-dinero`, `/mi-plan`, `/mi-historia`
2. Crear `layout.tsx` por sección con tabs horizontales
3. Mover páginas existentes a las nuevas ubicaciones (move con `git mv`)
4. Añadir `redirect()` desde las rutas viejas → nuevas en `middleware.ts` o vía `redirects` en `vercel.ts`
5. Actualizar sidebar (`AppSidebar`), bottom-nav (`MobileNav`), mobile-more-sheet, topbar resolver, command palette
6. Verificar que todos los Links internos sigan funcionando (`grep` por rutas viejas)

**Riesgo principal**: enlaces externos o bookmarks de usuarios apuntando a rutas viejas. Mitigación: redirects 308 (permanente).

**Acceptance criteria:**
- Visitar `/cuentas` redirige a `/mi-dinero/cuentas`
- Visitar `/mi-dinero` redirige a `/mi-dinero/cuentas`
- Sidebar muestra 4 grupos con sub-items expandibles
- Mobile bottom-nav muestra 4 botones
- Cmd+K resuelve todas las rutas nuevas

### Fase B — Mi dinero: refinamiento (1 sesión) ✅ `bc1b229`

1. Crear `/mi-dinero/tarjetas` (lista filtrada + hero deuda + CTA)
2. Excluir tarjetas de `/mi-dinero/cuentas`
3. Mejorar placeholder de `CardVisual` cuando no hay AVIF
4. Pulir `/mi-dinero/deudas` (header con contexto, KPI hero unificado)
5. Mover "Importar CSV" de ruta a dialog en `/mi-dinero/movimientos`
6. Agregar date picker para vista diaria en `/mi-dinero/movimientos`
7. Densidad mobile

**Acceptance criteria:**
- `/mi-dinero/cuentas` no muestra tarjetas
- `/mi-dinero/tarjetas` lista todas con utilización y próximo corte
- `/importar` redirige a `/mi-dinero/movimientos?import=open` y abre el dialog
- Placeholder de tarjeta sin AVIF se ve premium (no genérico)

### Fase C — Mi plan: refinamiento (1 sesión) ✅ `8c4da24`

1. Mover `/ajustes/recurring` → `/mi-plan/recurrentes`
2. Tab internos en `/mi-plan/layout.tsx`
3. Header KPI en `/mi-plan/presupuestos` (ritmo)
4. Vincular metas ↔ plan de ahorro
5. Allocation visual en `/mi-plan/ahorro` (qué % a qué meta)
6. Agrupación de eventos en cash-flow por semana
7. Recurrentes: agrupación por tipo + suscripciones detectadas

**Acceptance criteria:**
- Una meta puede asignar % de ahorro mensual
- Recurrentes agrupados visualmente por tipo
- Empty states editoriales en cada sub-tab

### Fase D — Mi historia: refinamiento (1 sesión) ✅ `2b9d86e`

1. Insights agrupados por mes
2. Insight → "acción tomada" estado
3. CategoryBreakdown migrado a detalle de informe
4. Lista de informes con timeline editorial
5. Cross-links entre insights e informes del mismo mes

**Acceptance criteria:**
- Insights se ven agrupados por mes
- Informe muestra breakdown por categoría
- Click en insight lleva a su informe del mes

### Fase E — Ajustes: consolidación (1 sesión) ✅ `66821b7`

1. Una sola página `/ajustes` con sidebar interno
2. Migrar contenido de las 5 sub-rutas
3. Eliminar las rutas viejas (con redirect a `/ajustes#seccion`)
4. Mobile: lista expandible

**Acceptance criteria:**
- `/ajustes` muestra todas las secciones
- `/ajustes/perfil-financiero` redirige a `/ajustes#perfil`
- Navegación por anchor funciona en mobile y desktop

### Fase F — Polish cross-cutting (1 sesión) ✅ `27cc038`

1. Audit de copy en cada página, reescribir headlines
2. Audit de espaciado: forzar gap-10/12 en todas las páginas
3. Empty states sistematizados (componente `<EmptyState>` rich)
4. Patrón de breadcrumb mini-link
5. Skip-link de accesibilidad
6. Hora-del-día contextual en `/dashboard` (opcional, si hay tiempo)

**Acceptance criteria:**
- Toda página de detalle tiene mini-link "← Sección"
- Empty states siguen mismo patrón
- No quedan `gap-8` sueltos en páginas top-level
- Lighthouse a11y ≥ 95

---

## 7. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| Bookmarks/links rotos | Alta | Redirects 308 desde toda ruta vieja por al menos 6 meses |
| Cmd+K confunde usuarios acostumbrados a viejos atajos | Media | Mantener atajos viejos como aliases |
| Tabs internos saturan en mobile | Media | Tabs scrollables + título de la sub-tab en el topbar |
| Migración rompe deep-links (ej. `/transacciones?day=…`) | Media | Tests manuales de cada query param en cada ruta nueva |
| Consolidar `/ajustes` esconde features que el usuario ya conocía | Baja | Anchors visibles + Cmd+K resuelve "alertas" directo |
| Mover `/ajustes/recurring` a `/mi-plan/recurrentes` confunde al user que sabe dónde estaba | Baja | El usuario es Daniel; aceptable |
| `/mi-dinero/tarjetas` requiere refactor de queries para filtrar | Media | Reusar `listAccountsWithBalance` con filtro post-query inicial |
| Imágenes de tarjetas siguen sin existir post-Fase B | Alta | Placeholder mejorado es lo que da el premium feel mientras se dropean AVIF |

---

## 8. Criterios globales de aceptación (al final del plan)

- [ ] Sidebar desktop muestra 4 grupos visibles + Ajustes en footer
- [ ] Mobile bottom-nav muestra 4 botones máx
- [ ] Toda ruta vieja redirige con 308 a la nueva
- [ ] Cmd+K resuelve todas las sub-tabs por nombre
- [ ] Cada sección posesiva (Mi dinero / Mi plan / Mi historia) tiene tabs horizontales
- [ ] Tarjetas tienen su propia sub-tab con UX dedicada
- [ ] `/importar` ya no existe como ruta — es CTA en Movimientos
- [ ] `/categorias` ya no existe como top-level — es tab interno de Ajustes
- [ ] `/ajustes/recurring` se llama `/mi-plan/recurrentes`
- [ ] Empty states están sistematizados (componente único)
- [ ] Mini-breadcrumb `← Sección` en toda página de detalle
- [ ] El usuario abre la app y nombra dónde está cada cosa **sin pensar más de 2 segundos**

---

## 9. Lo que NO entra en este plan (deja para después)

| Item | Razón |
|---|---|
| Motor de búsqueda imágenes (Brave + Claude Vision) | Bloqueado por API keys, post-IA |
| PDF export de informes | Nice-to-have, infra pesada |
| Sharing en pareja (multi-tenant UI) | Scope independiente |
| OCR de tickets | v2 explícito del blueprint |
| Voice input (Whisper) | v2 del blueprint |
| Belvo Open Banking (Fase 5b del roadmap viejo) | Post-MVP |
| Notificaciones push reales | Útil pero no bloquea IA |

---

## 10. Cómo empezar la siguiente sesión

**Prompt sugerido a pegar al inicio:**

```
Continuamos con el plan de IA v2. Antes de codear, leé:

1. docs/ROADMAP-IA-V2.md — fuente de verdad de este sprint (este doc)
2. docs/PROGRESS.md — estado de steps completados
3. memory/MEMORY.md — preferencias del usuario

Empezamos por la Fase A (Cimientos de IA): crear rutas /mi-dinero,
/mi-plan, /mi-historia con layouts, mover páginas existentes via git mv,
añadir redirects, actualizar sidebar/bottom-nav/cmdk/topbar.

NO refinar contenido en esta fase — la Fase A es puro re-ruteo. Las
páginas se ven igual que ahora, sólo viven en URLs nuevas.

Acceptance: visitar /cuentas redirige a /mi-dinero/cuentas. Sidebar
muestra 4 grupos. Mobile bottom-nav muestra 4 botones. Cmd+K resuelve
todas las rutas nuevas. No hay errores de typecheck/lint.

Si la Fase A queda en menos de 1 hora, continuar con la Fase B.
```

---

## 11. Cómo actualizar este doc

Cuando cierres una fase:
1. Marca la fase como ✅ en `## 6. Plan de migración`
2. Anota el SHA del commit que la cerró
3. Si surgió una decisión nueva durante la implementación, regístrala en `## 2. Decisiones arquitectónicas`
4. Si una decisión registrada quedó obsoleta, márcala con `~~tachado~~` — NO la borres
5. Si el alcance cambió, actualiza `## 0. Resumen ejecutivo`

---

## Apéndice A — Inspiraciones consultadas

| Producto | Qué tomar |
|---|---|
| Mercury (banco) | 4-5 secciones top-level, tarjetas como tab dedicada, copy editorial |
| Linear | Reducción radical de surface, una sola página de ajustes con secciones |
| Apple Wallet | Tarjeta como first-class citizen visual |
| Arc Browser | Posesivos en navegación ("Tu Library", "Tus Spaces") |
| Stripe Dashboard | Tabs horizontales sticky bajo el topbar |
| Revolut | Cards section separada con UX propia |
