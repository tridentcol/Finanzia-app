# Prompt — Exploración multi-agente de toda la app (Finanzia)

> Pégalo (o referéncialo) al inicio de una sesión nueva. Está diseñado para que Claude
> **despliegue múltiples agentes en paralelo** y produzca una **exploración** (hallazgos +
> recomendaciones priorizadas), **no** un plan de ejecución directo ni cambios de código.
> Es **read-only**: ningún agente edita archivos; el entregable es un informe.

---

## Contexto

Finanzia: webapp de finanzas personales con IA (Next.js 16 App Router, TS strict, Tailwind v4,
shadcn/ui, Supabase/Drizzle, Clerk, Vercel AI SDK, Visx, Motion, Vercel). Mandato de diseño
**Noir** (ver `CLAUDE.md` — es ley; cero emojis/gradientes/glow/saturación, números Geist Mono).
Fuentes de verdad: `docs/finanzia-blueprint.md`, `CLAUDE.md`, `docs/PROGRESS.md`,
`docs/ROADMAP-NEXT.md`, `docs/ROADMAP-IA-V2.md`, `docs/copilot-llm.md`.

## Objetivo

Auditar **TODO** y entregar un mapa accionable de mejoras: rendimiento, carga de secciones,
flujos, experiencia de usuario, accesibilidad, funcionalidades, salud de código/arquitectura,
datos/infra, y **los modelos de IA** (motor heurístico local + API externa) con foco especial
en **personalización por usuario vía fine-tuning** y alternativas.

## Cómo correrlo (orquestación)

Usa un **workflow multi-agente**. Patrón sugerido:
1. **Scout inline**: mapear estructura (`src/app`, `src/lib`, `src/components`), rutas, server
   actions, queries, y leer los docs canónicos para no auditar a ciegas.
2. **Fan-out**: un agente por dimensión (abajo), en paralelo, cada uno read-only, devolviendo
   hallazgos estructurados (schema: `{ area, hallazgo, evidencia (file:line), severidad
   crítica|alta|media|baja, impacto, esfuerzo S|M|L, recomendación }`).
3. **Verificación adversarial**: un pase que cuestione los hallazgos dudosos (¿es real?,
   ¿ya está resuelto?, ¿choca con Noir o con una regla de CLAUDE.md?).
4. **Síntesis**: deduplicar, priorizar por (impacto × severidad ÷ esfuerzo), separar
   **quick-wins** de **apuestas estratégicas**, y escribir el informe a
   `docs/AUDIT-findings.md`. No ejecutar nada.

## Dimensiones (un agente por bloque)

1. **Rendimiento y carga** — bundle/code-splitting, Core Web Vitals, estrategia de render
   (RSC vs client, PPR/Cache Components de Next 16, `use cache`), TTFB por sección, costo de
   View Transitions, Visx y Motion, optimización de imágenes/fuentes, waterfalls de fetch,
   caching (runtime cache, revalidate), Lighthouse por ruta.
2. **UX y adherencia Noir** — consistencia visual, jerarquía, estados loading/empty/error en
   cada página, micro-interacciones, densidad, copy; cumplimiento estricto del mandato Noir;
   mobile (iOS Safari/PWA/in-app, Android) incluido el comportamiento ya cerrado del teclado.
3. **Accesibilidad** — WCAG AA: foco visible, tap-targets, ARIA/roles, contraste, navegación
   por teclado, `prefers-reduced-motion`, lectores de pantalla en flujos clave, live regions
   del copiloto.
4. **Flujos y navegación** — onboarding; las 4 secciones posesivas (Hoy / Mi dinero / Mi plan /
   Mi historia); alta de movimientos, multi-divisa, deudas (modelo dual tarjetas/`debts`),
   presupuestos, metas, ahorro, recurrentes, imports; fricción, callejones sin salida,
   recuperación de errores, profundidad de navegación.
5. **Funcionalidad y correctitud** — completitud vs blueprint; manejo de dinero (Dinero.js +
   `numeric`, nunca float; original + base currency); validaciones Zod; contrato de respuesta
   `{ ok, data } | { ok, error }`; edge cases; integridad de datos; confirmación UI antes de
   mutaciones del LLM (regla 6).
6. **IA — heurístico + API + personalización (FOCO)** — ver bloque expandido abajo.
7. **Salud de código y arquitectura** — reglas de `CLAUDE.md` (≤300 líneas/componente, server
   components by default, sin barrels, `env` centralizado, queries en `db/queries` o RSC),
   `any`/deuda de tipos, cobertura de tests, duplicación, separación de responsabilidades.
8. **Datos e infra** — schema Drizzle, migraciones, índices, RLS en toda tabla con `user_id`,
   pgvector/embeddings, crons (Trigger.dev), tasas de cambio, uso de Redis/Upstash, Sentry,
   verificación de deploys en Vercel.

## Bloque expandido — IA y personalización por usuario

El copiloto ya tiene motor dual: **heurístico local** (sin IA, reglas/plantillas → `Turn[]`) y
**API externa** (OpenAI/Claude vía AI SDK, `streamText`, tool-calls con confirmación UI,
auto-categorización con pgvector kNN + few-shot). El usuario quiere **explorar** cómo llevar la
personalización del comportamiento del bot **por usuario** a su máxima expresión. Evaluar:

- **Estado actual**: calidad de prompts/herramientas, ruteo heurístico↔LLM, manejo de contexto
  conversacional (`ConversationContext`), embeddings y categorización, costo/latencia/calidad.
- **Personalización por usuario** — comparar enfoques y recomendar (no implementar):
  - **Fine-tuning** (OpenAI) por usuario o por cohorte: viabilidad, costo, latencia, deriva,
    mantenimiento, privacidad (datos financieros), cuándo SÍ vale vs cuándo no.
  - **Alternativas más baratas/rápidas**: RAG sobre el historial del usuario, memoria de
    preferencias, few-shot dinámico desde transacciones/decisiones pasadas, system prompt
    personalizado, perfiles de tono/estilo, aprendizaje de preferencias implícito.
  - **Vercel AI Gateway** para ruteo/fallback/observabilidad; selección de modelo por tarea.
  - **Evaluación**: cómo medir calidad/personalización (evals, golden sets, feedback loop),
    guardarraíles (regla 6: nunca mutar sin confirmación), y privacidad/PII.
- Entregable de este bloque: matriz de opciones (esfuerzo × impacto × riesgo) + recomendación
  por fases.

## Restricciones

- **Read-only**: ningún agente modifica código. Salida = informe.
- **Respeta el mandato Noir y `CLAUDE.md`**: cualquier recomendación que los viole se descarta
  o se marca como "fuera de mandato".
- **Patrones estándar, no sobre-ingeniería**. Marca explícitamente cualquier cobertura que se
  haya limitado (top-N, muestreo) en lugar de auditar al 100%.
- El push lo hace el usuario; los commits los hace Claude por cambio (si el informe se escribe a
  `docs/`, commitearlo). Trailer: `Claude Opus 4.8 (1M context)`.

## Entregable

`docs/AUDIT-findings.md`: resumen ejecutivo, top quick-wins, apuestas estratégicas, y por
dimensión la tabla de hallazgos priorizados. Al final, una **hoja de ruta sugerida por fases**
(pero como recomendación, para decidir juntos — no auto-ejecutar).
