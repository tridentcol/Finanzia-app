# Handoff — Rollout de cache de navegación (Frente B, capa 2)

> Sesión fresca. El diagnóstico y la prueba ya están hechos y **validados en prod**.
> Esto es solo el **rollout** del patrón a las rutas restantes. `CLAUDE.md` es ley.
> Contexto completo en la memoria `project-perf-navigation`.

## Qué ya está hecho (en `main`, deployado)

- `experimental.staleTimes {dynamic:30, static:180}` (`next.config.ts`) → re-visitas instantáneas.
- getProfile dedup en 11 pages.
- **Cache de datos del dashboard** — patrón a replicar:
  - `src/lib/db/queries/dashboard.ts` → `getDashboardData(userId, baseCurrency, today)` envuelto en `unstable_cache` (key incluye userId/baseCurrency/today; tag `dashboard:${userId}`; `revalidate:30` backstop).
  - `src/lib/cache/dashboard.ts` → `dashboardTag(userId)` + `revalidateDashboard(userId)` = `revalidatePath('/dashboard')` + `updateTag(dashboardTag(userId))`.
  - Invalidación cableada en Server Actions de saldo: `mi-dinero/movimientos/actions.ts`, `mi-dinero/cuentas/actions.ts`, `importar/actions.ts`.
  - **Validado por el usuario en deploy:** dashboard se siente más rápido que cuentas (no cacheado) y el saldo se actualiza al instante tras mutar.

## Hechos de Next 16.2 (no re-investigar)

- `experimental.ppr` REMOVIDO → PPR solo vía `cacheComponents` (flag global todo-o-nada). NO lo activamos en este rollout.
- `revalidateTag` exige 2º arg `profile` (da error con 1). Para invalidar tags de `unstable_cache` desde Server Action: **`updateTag(tag)`** (1-arg) — validado que sí bustea `unstable_cache`.
- `unstable_cache` funciona SIN `cacheComponents`. Este rollout NO usa el flag.

## Estrategia de invalidación — DEFINIR CON EL USUARIO primero

Recomendado: **tag coarse único `data:${userId}`**.
- Toda data cacheada de toda ruta usa ese tag.
- Toda Server Action que muta llama un helper `revalidateUserData(userId)` (→ `updateTag(\`data:${userId}\`)`), además de sus `revalidatePath` actuales.
- Single-user: mutás poco, navegás mucho → navegación siempre cacheada; cualquier mutación refresca todo. Sin riesgo de "olvidé invalidar la ruta X".
- Alternativa (más granular, más compleja, más riesgo): tags por entidad (`accounts:${userId}`, `transactions:${userId}`, …). Probablemente innecesario.

Si se adopta el tag coarse, conviene unificar: `dashboard:${userId}` puede quedar o migrar a `data:${userId}`.

## Rutas a migrar (replicar patrón dashboard)

Prioridad por tráfico:
1. `mi-dinero/cuentas`, `mi-dinero/movimientos` (las más visitadas)
2. `mi-dinero/cash-flow`, `mi-dinero/deudas`, `mi-dinero/tarjetas`
3. `mi-plan/presupuestos`, `mi-plan/metas`, `mi-plan/ahorro`, `mi-plan/recurrentes`
4. `mi-historia/insights`, `mi-historia/comercios`, `mi-historia/informes`
5. `mi-dinero/cuentas/[id]`, `mi-dinero/tarjetas/[id]`, `mi-historia/informes/[period]`
6. `ajustes` (baja prioridad — cambia poco)

Verificar antes: `mi-dinero`, `mi-historia`, `mi-plan` (index) — confirmar si fetchean o solo redirigen.

Cuidado: lo que dependa de fecha/hora (proyecciones, labels relativos, saludo) va FUERA del cache (como en dashboard). Incluir `today` en la key cuando aplique. Páginas con `searchParams` (insights, comercios, movimientos, informes): la key del cache debe incluir los params relevantes.

## Por cada ruta

1. Extraer el fetch de datos a una función cacheada (`unstable_cache`, tag `data:${userId}`).
2. Mantener fuera del cache lo dinámico de request (cookies de privacidad, searchParams para UI, derivados de tiempo).
3. Asegurar que TODA Server Action que afecte esos datos bustee el tag (`revalidateUserData`).
4. `pnpm lint` + `pnpm typecheck` + `pnpm test` (si toca lógica) + `pnpm build`.
5. Commit por ruta (o por grupo lógico). Trailer `Co-Authored-By: Claude Opus 4.8 (1M context)`. **No push** (lo hace el usuario).
6. Verificación en deploy por el usuario: la sección se siente más rápida + tras mutar muestra fresco.

## Prompt para pegar en la sesión nueva

```
Seguimos el Frente B (navegación fluida). El diagnóstico y la prueba ya están hechos y
validados en prod — NO re-diagnostiques. Leé la memoria project-perf-navigation y
docs/PERF-ROLLOUT-NEXT-SESSION.md entero. CLAUDE.md es ley.

El patrón está validado en dashboard (unstable_cache + updateTag, sin el flag cacheComponents).
Toca hacer el ROLLOUT a las rutas restantes. Primero confirmá conmigo la estrategia de
invalidación (recomendado: tag coarse data:${userId}). Luego migrá ruta por ruta empezando
por cuentas y movimientos, verificando lint+typecheck+test+build y commit por ruta (sin push).
Si algo necesita la app corriendo para verificar, decímelo.
```
