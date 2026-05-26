# Deploy a Vercel

Guía para llevar Finanzia de localhost a producción en Vercel. Pensada para que el deploy quede igual de funcional que el dev local, sin sorpresas.

---

## 1. Variables de entorno

Pegar en **Vercel Dashboard → Project Settings → Environment Variables**. Marcar `Production` y `Preview` (excepto las que indique).

> **Importante**: el cliente Supabase REST se autentica con `NEXT_PUBLIC_SUPABASE_ANON_KEY`. El servidor (Drizzle + Server Actions) usa `DATABASE_URL` / `DIRECT_URL` con el password del usuario `postgres.<ref>`. RLS depende de Third-Party Auth con Clerk — ya configurado.

### Supabase

| Variable | Valor | Notas |
|---|---|---|
| `DATABASE_URL` | `postgresql://postgres.anyinryjupznpouaxhtp:<PASSWORD>@aws-1-us-west-2.pooler.supabase.com:6543/postgres` | Pooler (transaction). El password = el que está en tu `.env.local`. |
| `DIRECT_URL` | `postgresql://postgres.anyinryjupznpouaxhtp:<PASSWORD>@aws-1-us-west-2.pooler.supabase.com:5432/postgres` | Direct connection. Solo para migraciones. |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://anyinryjupznpouaxhtp.supabase.co` | Público. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | El JWT legacy anon (eyJ…) | Público. |
| `SUPABASE_SERVICE_ROLE_KEY` | El JWT service_role (eyJ…) | **Server only**. Marcar como sensitive. |

### Clerk

| Variable | Valor | Notas |
|---|---|---|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_test_…` | El de tu `.env.local`. |
| `CLERK_SECRET_KEY` | `sk_test_…` | Server only. |
| `CLERK_WEBHOOK_SECRET` | `whsec_…` | Se configura en paso 3 (post-deploy). Puedes dejarla vacía en el primer deploy — el handler hace guard. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/dashboard` | |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/dashboard` | |

### App

| Variable | Valor | Notas |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://<tu-dominio>.vercel.app` | Reemplazar tras el primer deploy. |
| `CRON_SECRET` | El de tu `.env.local` | Server only. Protege los endpoints `/api/cron/*`. |

### Opcionales (steps futuros)

`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `TRIGGER_API_KEY`, `TRIGGER_API_URL`, `EXCHANGE_RATE_API_KEY`, `SENTRY_DSN`. `env.ts` las trata como opcionales, así que el build no falla si están vacías. Se llenan a medida que se activan los steps que las consumen.

---

## 2. Configurar dominio en Clerk

Clerk dev instance acepta tráfico desde cualquier origen, pero para que los redirects y session sync funcionen bien:

1. **Clerk Dashboard → Domains → Add domain** → pegar `https://<tu-dominio>.vercel.app`.
2. **Allowed Origins**: agregar el mismo.
3. Si quieres dominio custom (`finanzia.com`), agregarlo después.

---

## 3. Webhook Clerk → Supabase

Después del primer deploy exitoso:

1. **Clerk Dashboard → Webhooks → Add endpoint**.
2. **URL**: `https://<tu-dominio>.vercel.app/api/webhooks/clerk`.
3. **Events**: `user.created`, `user.updated`, `user.deleted`.
4. Clerk te muestra un **Signing Secret** (`whsec_…`). Pégalo en Vercel como `CLERK_WEBHOOK_SECRET` y redeploy (o usa "Edit Variable → Save → Redeploy").

> **Nota**: si no configuras el webhook, la app sigue funcionando — `getCurrentUser()` hace lazy upsert. El webhook solo es necesario para mantener sincronizados nombre/email cuando el usuario los cambia en Clerk.

---

## 4. Third-Party Auth Clerk ↔ Supabase

Ya configurado en dev (instancia `Development`). Para production:

1. Clerk Dashboard → **Switch to Production instance** (cuando estés listo).
2. Generar `pk_live_…` y `sk_live_…`. Reemplazar las dev en Vercel.
3. Volver a Supabase Dashboard → Authentication → Third Party Auth → editar el provider Clerk → cambiar el Issuer URL al de production (`https://<tu-app>.clerk.accounts.dev`).

Para el primer deploy con dev keys: el setup actual funciona tal cual.

---

## 5. Configuración Vercel

`vercel.json` ya está en el repo:
- Region: `pdx1` (Portland) para minimizar latencia a Supabase us-west-2.
- Build/install: `pnpm`.
- Security headers: X-Frame-Options DENY, X-Content-Type-Options nosniff, Referrer-Policy, Permissions-Policy.

No necesitas tocar nada de eso desde el dashboard.

---

## 6. Flujo de deploy

1. Push a `main` → Vercel auto-deploy.
2. Primer build: revisa logs en Vercel Dashboard. Si falla por env vars, agregarlas y redeploy.
3. Tras build exitoso, abrir la URL preview/prod. Verificar:
   - `/` renderiza la landing.
   - `/sign-in` abre Clerk.
   - Tras autenticarte, `/dashboard` carga tu saldo (puede ser $0 si la cuenta vacía).
4. Configurar el webhook (paso 3 arriba).

---

## 7. Validación post-deploy

| Check | Cómo | Resultado esperado |
|---|---|---|
| Build OK | Vercel logs | `Compiled successfully`, no errors |
| Auth Clerk | Abrir `/`, click "Iniciar sesión" | Modal Clerk abre |
| RLS Third-Party Auth | Tras login, abrir `/cuentas` | No error 500, sin filas si no has creado |
| Crear cuenta | Cmd+K → "Nueva cuenta" → fill → submit | Fila aparece, toast verde |
| Crear transacción | Cmd+K → "Nueva transacción" → fill → submit | Aparece en `/transacciones` |
| View Transitions | Navegar entre `/dashboard` y `/cuentas` | Animación spatial del indicador rail |

---

## 8. Troubleshooting

**Build falla con `Variables de entorno inválidas`**: alguna env var requerida está vacía o mal formada. Revisar la lista de §1. Las opcionales aceptan `""` (preprocess en `env.ts`).

**Tenant or user not found en Postgres**: el host del pooler está mal. El correcto para este proyecto: `aws-1-us-west-2.pooler.supabase.com`. No `aws-0`, no otra región.

**RLS bloquea queries en prod pero funcionaba en dev**: revisar que el Issuer URL de Clerk en Supabase → Third Party Auth coincida con el de tu instancia (production tiene URL distinta a development).

**Webhook devuelve 503**: `CLERK_WEBHOOK_SECRET` no está configurado. Pegarlo en Vercel y redeploy.

**Errores `category not found` después de editar**: el cache del `(app)/layout` no se invalidó. Los dialogs llaman `router.refresh()` después de un éxito — si no ves los cambios, hard-refresh la página.
