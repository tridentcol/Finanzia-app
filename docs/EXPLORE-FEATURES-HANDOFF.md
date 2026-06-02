# Handoff — Explorar funcionalidades a crear y fortalecer (Finanzia)

> Sesión NUEVA de producto. El objetivo es **explorar, proponer y priorizar**
> funcionalidades nuevas que hagan a Finanzia diferenciadora, **y fortalecer las
> que ya existen**. Es un proceso de producto: explorar → proponer con
> impacto×esfuerzo×diferenciación → elegir junto al usuario → construir
> verificando. `CLAUDE.md` es ley (Mandato Noir + reglas no negociables).

## Leer primero (no re-derivar)

- `CLAUDE.md` — stack, arquitectura, reglas no negociables (incluida la #16: el
  nav del shell apunta a rutas reales, intocable).
- `docs/finanzia-blueprint.md` — fuente de verdad del producto.
- `docs/ENRICH-NEXT-SESSION.md` — Frente C: **inventario de lo que ya existe**,
  filtros de diferenciación y semillas. (Este handoff continúa ese Frente C.)
- Memorias: `project-enrich-next`, `project-checkin-feature`,
  `project-perf-navigation`, `project-nav-prefetch-locked`, `feedback-*`.

## Qué ya está hecho (no repetir)

- **Frente A** — tono del copiloto accesible (sheet + auto-intro). ✅
- **Frente B** — navegación fluida: cache de datos coarse (`data:${userId}`) en
  todas las rutas + el fix real (nav del shell apunta a rutas reales, no
  redirects → `prefetch={true}` precarga el dato). Validado en prod. PPR se
  exploró y se descartó (streamea skeleton, va en contra). ✅
- **Frente C (en curso)** — 2 semillas shipped:
  - **Check-in semanal proactivo** (`src/lib/ai/checkin/`, cron domingos, card en
    dashboard): digest que te busca con la foto de tu semana, narrativa LLM con
    tu persona + fallback determinista. Tabla `weekly_checkins` (migración 0002,
    RLS aplicada a prod). Follow-up abierto: **email saliente** (Resend solo está
    cableado para ingesta, no para enviar).
  - **What-if / escenarios** (`what-if-panel.tsx` en cash-flow): simula recortes
    de gasto → saldo a 90d + ETA de metas. Sobre `projectCashFlow` + `getMetasData`.

## El encargo de esta sesión

**Dos vertientes, evaluar ambas:**

1. **Crear** funcionalidades nuevas diferenciadoras.
2. **Fortalecer** lo que ya existe (profundizar, no solo agregar).

Filtros para evaluar cada idea (del Frente C):
1. ¿Resuelve un dolor real recurrente que las apps LATAM no resuelven bien?
2. ¿Apalanca lo que ya tenemos (embeddings, copiloto, multi-divisa, insights,
   proyección, recurrentes) en vez de construir de cero?
3. ¿Es más "caro/editorial" (mandato #15), no un dashboard genérico más?
4. ¿Respeta regla 6 (IA propone, UI confirma) y la privacidad (PII/transacciones
   sueltas no salen a LLM; el patrón actual solo manda agregados)?
5. Impacto × esfuerzo × riesgo — preferir lo que mueve la aguja con infra existente.

**Semillas que quedaron** (del doc; el usuario YA descartó suscripciones
inteligentes y auto-reglas aprendidas por ahora):
- Patrimonio en el tiempo (tendencia + composición histórica; hoy es snapshot).
- Salud financiera explicada (score con el porqué, no número opaco).
- Captura de recibos (OCR) → transacción. Ahorro automatizado por reglas.
- Modo hogar/compartido (infra multi-tenant ready). Modo viaje multi-divisa.
- Helpers tributarios LATAM (DIAN).
- El salto grande: agregación bancaria real (Belvo/Finerio) — evaluar aparte.
- **Fortalecer:** profundizar el copiloto proactivo (más nudges, el email del
  check-in), enriquecer insights, what-if más rico (multi-meta, runway),
  reportes, categorización.

## Cómo trabajar (preferencias del usuario, ver memorias `feedback-*`)

- **Decidir, no devolver menús** (`feedback-decide-dont-punt`): traé
  recomendaciones con criterio, no listas de 11 opciones. Para forks de producto
  reales, recomendá fuerte y arrancá; preguntá solo lo genuinamente suyo.
- **Patrones estándar, no sobre-ingeniería** (`feedback-standard-patterns`).
  Saber cuándo parar de optimizar es parte del criterio.
- **Mandato Noir es ley**: editorial, monocromático, sin emojis/gradientes/glow;
  acento lavanda `accent-ai` SOLO para presencia de IA; números Geist Mono tabular.
- **Verificar siempre**: lint + typecheck + build + test por cambio. Commit por
  pieza lógica. **El push a main lo hace el usuario** (no pushear).
- **DB**: migraciones aditivas se pueden aplicar vía Supabase MCP (proyecto
  `anyinryjupznpouaxhtp`); RLS obligatorio en toda tabla con `user_id` (rule 7).
- **Prefetch no anda en `pnpm dev`**, solo en prod build → validar navegación en deploy.

## Prompt para pegar en el chat nuevo

```
Quiero explorar funcionalidades nuevas para Finanzia y fortalecer las que ya
existen. Leé docs/EXPLORE-FEATURES-HANDOFF.md entero, CLAUDE.md (es ley) y las
memorias que referencia — NO re-derives lo ya hecho (cache de navegación,
check-in semanal, what-if). Arrancá orientándote en el inventario y traeme una
recomendación CON CRITERIO (no un menú largo) de las 2-3 direcciones de mayor
impacto×leverage×diferenciación, separando "crear nuevo" de "fortalecer
existente", y por qué. Elegimos juntos y construimos verificando, commit por
pieza, sin push.
```
