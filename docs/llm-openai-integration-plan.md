# Plan — Integración profesional del LLM (OpenAI gpt-5 mini) en el copiloto

## Contexto

El copiloto hoy tiene un motor local (NLU por keywords+embeddings, motor de
consultas componible, ruteo local-first) y un camino LLM que apunta a **Anthropic**
(`runCopilotChat` → `getAnthropic` → `claude-sonnet-4-6`). Queremos hacer del **LLM
el cerebro completo del sistema con OpenAI** (modelo de prueba `gpt-5.4-mini`),
que pueda **leer todos los datos del usuario**, dé respuestas **profesionales,
útiles y personalizadas por perfil**, con rutas y acceso a datos optimizados.

> ⚠️ **Seguridad.** La API key de OpenAI fue compartida en chat y queda EXPUESTA.
> Va únicamente en `.env.local` (gitignored) como `OPENAI_API_KEY=...` o en el
> Vault de integraciones — **nunca** en código ni en commits. **Rotarla** en
> platform.openai.com tras las pruebas. El plan asume que el ejecutor la coloca en
> `.env.local`; no debe escribirla en ningún archivo versionado.

## Hallazgos de investigación (model + SDK)

- **Familia GPT-5** (gpt-5 / gpt-5-mini / gpt-5-nano y point-releases como
  gpt-5.4) corre sobre la **Responses API**. El proveedor `@ai-sdk/openai` con
  `openai('<model>')` auto-rutea a Responses; no hay que llamar `.responses()`.
- **Controles que más mueven la asertividad** (vía `providerOptions.openai`):
  - `reasoningEffort`: `minimal | low | medium | high` (default medium). Más alto =
    mejor razonamiento/planeación de tools, más latencia/costo. Para asesoría
    financiera: **medium**; para lookups simples: low/minimal.
  - `textVerbosity`: `low | medium | high` (default medium). Para UX Noir
    (conciso, editorial): **low**, y las **instrucciones explícitas mandan** sobre
    verbosity (si el prompt pide "5 viñetas", las da).
  - `reasoningSummary`: `auto | detailed` (opcional; en prod normalmente off).
  - **No usar `temperature`** con modelos de razonamiento (la ignoran/rechazan).
- **Tool calling / structured outputs**: en Responses los schemas se normalizan a
  strict (additionalProperties:false, todos required); con structured outputs
  conviene `parallelToolCalls:false`. Nuestros tools ya validan con Zod.
- **Estado conversacional**: se puede usar `previous_response_id` + `store:true`
  (OpenAI guarda el hilo) o pasar los mensajes nosotros. **Ya gestionamos el
  estado** (tablas conversations/messages + contexto del cliente), así que pasamos
  mensajes y dejamos **`store:false`** por privacidad de datos financieros.
- **"Uso gratuito"**: el tier gratis de OpenAI suele requerir **opt-in a compartir
  prompts** (`store:true` / data-sharing). Para datos financieros, recomendado
  `store:false`; documentar el trade-off y dejar `store` configurable por env.

Fuentes: ai-sdk.dev/cookbook/guides/gpt-5, cookbook.openai.com/examples/gpt-5/*,
developers.openai.com/api/docs/guides/{conversation-state,function-calling,structured-outputs}.

## Decisiones

1. **OpenAI por defecto**, Anthropic como fallback. Selección por env:
   `COPILOT_LLM_PROVIDER=openai|anthropic` (default `openai`),
   `COPILOT_LLM_MODEL` (default `gpt-5.4-mini`), `COPILOT_REASONING_EFFORT`
   (default `medium`), `COPILOT_TEXT_VERBOSITY` (default `low`),
   `COPILOT_STORE` (default `false`).
2. **El modelo lee TODO** vía un catálogo de tools ampliado que cubre cada query
   de `src/lib/db/queries/*` + un tool genérico `queryTransactions` que reusa el
   **motor de consultas componible** (`src/lib/copilot/query/{parse?,execute}`)
   para agregaciones precisas sin alucinar números.
3. **Personalización por perfil**: un *profile snapshot* compacto se inyecta en el
   system prompt en cada request.
4. **Tools devuelven datos COMPACTOS** (agregados, no dumps) — clave para
   asertividad y costo.
5. **Flag de prueba** `COPILOT_FORCE_LLM=1` para enrutar TODO al LLM (saltando el
   local-first) mientras se evalúa el modelo.

## Fase O1 — Config de proveedor/modelo + env + probe (1 commit)
- `src/lib/env.ts`: agregar (todas opcionales con default en código, no en Zod si
  se prefiere): `COPILOT_LLM_PROVIDER`, `COPILOT_LLM_MODEL`, `COPILOT_REASONING_EFFORT`,
  `COPILOT_TEXT_VERBOSITY`, `COPILOT_STORE`, `COPILOT_FORCE_LLM`.
- `src/lib/ai/openai.ts`: exportar el modelo de chat configurable; asegurar que
  `getOpenAI({ scope: 'chat' })` resuelve con la key env. Confirmar/levantar la
  versión de `@ai-sdk/openai` (instalada ^3.0.65) que soporte gpt-5 reasoning
  params; si no, `pnpm add @ai-sdk/openai@latest ai@latest`.
- `scripts/probe-llm.ts`: script que dispara una respuesta mínima al modelo
  configurado con la key de `.env.local` y reporta si el id existe (gpt-5.4-mini)
  o sugiere fallback `gpt-5-mini`. (`pnpm tsx --env-file=.env.local scripts/probe-llm.ts`).

## Fase O2 — runCopilotChat sobre OpenAI gpt-5 mini (1 commit)
`src/lib/ai/copilot/index.ts`:
- Seleccionar provider por `COPILOT_LLM_PROVIDER`: `getOpenAI({userId, scope:'chat'})`
  o `getAnthropic({userId})`.
- `model: provider(COPILOT_LLM_MODEL)`.
- `providerOptions: { openai: { reasoningEffort, textVerbosity, store } }` (solo
  cuando el provider es openai). Sin `temperature`.
- `stopWhen: stepCountIs(8)` (más pasos para encadenar varios tools de lectura).
- Mantener `convertToModelMessages`, `onFinish`, y el manejo de streaming
  (incluye partes `reasoning` si llegan — el cliente ya ignora lo no-texto).
- Devolver null si no hay provider del tipo elegido (degrada a local/fallback).

## Fase O3 — Catálogo de tools de lectura completa (2 commits)
`src/lib/ai/copilot/tools/*` + `tools.ts`. Añadir tools de SOLO LECTURA (con
salidas compactas) mapeando las queries existentes:
- `getDebts` → `getDebtsSummary` + `listDebts` (resumen + por deuda).
- `getRecurring` / `getSubscriptions` → `listRecurringForUser` (activos, total/mes).
- `getSavings` → `getSavingsHeroData` + `listSavingsPeriods` (último período).
- `getGoals` → `listGoalsForUser`.
- `getAccounts` → `listAccountsWithBalance` (incluye crédito/dormancia básica).
- `getTopMerchants` → `listMerchantsForUser` (período).
- `getCashFlow` → `getNetCashFlowForPeriod` (income/expense/net por período + compare).
- `getAdvice` → `collectLocalInsights` (expone los 9 detectores locales al LLM).
- `queryTransactions` (GENÉRICO, el más potente): inputSchema = el IR de
  `src/lib/copilot/query/types.ts` (metric, subject, groupBy, filters, period) →
  ejecuta `executeQuery`/`executeCompare` → devuelve filas/escalar. El LLM arma la
  consulta; nosotros la corremos (cero alucinación de cifras).
- Resolver nombres→ids dentro de cada tool (categoría/cuenta/comercio) reusando los
  slot extractors o `listAvailableCategories`/`listUserAccountsBasic`.
- Mantener las `propose-*` (mutación con confirmación) intactas.

## Fase O4 — Profile snapshot + system prompt profesional (1 commit)
- `src/lib/ai/copilot/profile-snapshot.ts` (server-only): `buildProfileSnapshot(ctx)`
  que arma un bloque compacto con: moneda base, país/locale, plan de ahorro
  (método/meta de `savings_plans`), # cuentas y tipos, si tiene presupuestos/deudas/
  metas activos, top-3 categorías de gasto del mes, ingreso/gasto del mes. Todo en
  ≤ ~600 tokens. Reusa queries existentes (sin nuevas pesadas).
- `src/lib/ai/copilot/system-prompt.ts`: reescribir a persona de **asesor
  financiero profesional** (es-CO, COP, tono Noir, cero emojis), con:
  - El profile snapshot inyectado.
  - Reglas: nunca inventar cifras (usar tools), citar de dónde sale el dato,
    respuestas accionables y personalizadas al perfil, priorizar el consejo más
    relevante, formato conciso (viñetas/numeros), confirmar antes de mutar.
  - Guía de cuándo usar cada tool (especialmente `queryTransactions`).

## Fase O5 — Disciplina de contexto / salidas compactas (1 commit)
- Auditar cada tool: límites de filas, recortar campos innecesarios, montos ya
  formateados o numéricos pero compactos. Nunca devolver 500 transacciones crudas.
- `listRecentTransactions`/`searchTransactions`: cap 15–20 + agregados.
- Asegurar que el system prompt + snapshot + tool outputs caben holgados en
  contexto y son densos en información.

## Fase O6 — Ruteo, persistencia y privacidad (1 commit)
- `src/app/api/ai/chat/route.ts`: respetar `COPILOT_FORCE_LLM` (si on y hay
  provider → saltar local-first y mandar al LLM). Mantener local-first por default.
- `store:false` (privacidad) salvo que `COPILOT_STORE=true`.
- Conservar persistencia conversations/messages y headers (`x-copilot-mode: llm`).
- Telemetría dev: loguear modelo, reasoningEffort, # tool calls, tokens si el SDK
  los expone (`FINANZIA_COPILOT_DEBUG=1`).

## Fase O7 — Integraciones UI (key del usuario) (1 commit, opcional)
- Verificar el flujo de `ajustes/integraciones` para pegar la key OpenAI con scope
  `chat` (no solo `embed`) y validar la key (probe). Si la UI ya soporta OpenAI,
  solo asegurar el scope `chat`. (Para la prueba inicial basta `OPENAI_API_KEY` en
  env; esta fase habilita multi-tenant.)

## Fase O8 — Verificación (1 commit)
- `pnpm typecheck && pnpm lint && pnpm test && pnpm build`.
- `pnpm tsx --env-file=.env.local scripts/probe-llm.ts` (confirma gpt-5.4-mini).
- Manual (Cmd+J) con `OPENAI_API_KEY` puesta y `COPILOT_FORCE_LLM=1`:
  - "¿cómo está mi situación financiera?" → usa varios tools, responde por perfil.
  - "¿cuánto gasté en mercado vs restaurantes este trimestre?" → `queryTransactions`.
  - "¿qué me conviene hacer con mis deudas?" → `getDebts` + consejo accionable.
  - "regístrame un gasto de 50k en uber" → `proposeCreateTransaction` → confirmación.
  - Verificar que NO inventa cifras y cita los datos.

## ¿Recopilar más información? (decisión)
Sí, pero **reusando lo que ya existe primero**. El ejecutor debe inspeccionar el
schema `profiles` y `savings_plans`:
- Si ya hay país/locale, ingreso, método de ahorro → el snapshot los usa.
- Si faltan señales clave de personalización (ingreso mensual aproximado, meta
  financiera principal, tolerancia al riesgo), **proponer** (no obligatorio para la
  prueba): 3 campos opcionales en `profiles` + un mini-paso de onboarding. Dejarlo
  como fase O9 opcional; para evaluar el modelo basta el snapshot derivado de datos
  existentes.

## Archivos clave
Modificar: `src/lib/env.ts`, `src/lib/ai/openai.ts`, `src/lib/ai/copilot/index.ts`,
`src/lib/ai/copilot/system-prompt.ts`, `src/lib/ai/copilot/tools.ts` (+ nuevos en
`tools/`), `src/app/api/ai/chat/route.ts`. Nuevos:
`src/lib/ai/copilot/profile-snapshot.ts`, `scripts/probe-llm.ts`.
Reusar: queries de `src/lib/db/queries/*`, motor de consultas
`src/lib/copilot/query/{types,parse,execute,to-answer}.ts`, `collectLocalInsights`
(`src/lib/ai/insights`), Vault (`src/lib/integrations/store.ts`).

## Restricciones (mandato + seguridad)
TypeScript strict, sin `any`/`eslint-disable`/`ts-expect-error`/`--no-verify`.
Server-only en todo lo de IA/DB. Dinero nunca float para math que importe. RLS
respetada (tools filtran por `userId` del contexto, defensa sobre RLS). **La API
key SOLO en `.env.local`/Vault, jamás en código ni commits; rotarla tras probar.**
Cero emojis/gradiente/glow. Toda mutación pasa por ConfirmDialog + Server Action.

## Cadence de commits
Un commit por fase (O1…O8), mensaje en español con el porqué, cerrando con
`Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`. `pnpm
typecheck` (exit real) tras cada commit; `typecheck && lint && test` al cerrar.
Sin push, sin tocar git remote/config. Los pasos que requieren la key/DB los
corre el usuario o se ejecutan solo si hay credenciales locales.
