import { z } from 'zod'

/**
 * Convierte string vacío a undefined antes de validar.
 * En .env.local es común dejar `FOO=` (string vacío) como placeholder; sin esto
 * `.optional()` lo rechaza porque solo ignora `undefined`.
 */
const optionalString = (schema: z.ZodString = z.string().min(1)) =>
  z.preprocess((v) => (v === '' ? undefined : v), schema.optional())

/**
 * Server-side environment variables.
 * Validados en runtime. Si falta uno obligatorio, la app no inicia.
 *
 * Las vars marcadas opcionales se completan a medida que avanzan los steps;
 * el código que las consume debe hacer guard explícito.
 */
const serverSchema = z.object({
  // App
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Database — requeridas siempre.
  DATABASE_URL: z.string().url(),
  DIRECT_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  // Auth — secret key requerida; webhook secret opcional hasta configurar el endpoint.
  CLERK_SECRET_KEY: z.string().min(1),
  CLERK_WEBHOOK_SECRET: optionalString(),

  // AI — opcionales hasta Step 9.
  ANTHROPIC_API_KEY: optionalString(),
  OPENAI_API_KEY: optionalString(),

  // Upstash Redis — opcional hasta Step 8.
  UPSTASH_REDIS_REST_URL: optionalString(z.string().url()),
  UPSTASH_REDIS_REST_TOKEN: optionalString(),

  // Trigger.dev — opcional.
  TRIGGER_API_KEY: optionalString(),
  TRIGGER_API_URL: optionalString(z.string().url()),

  // Exchange rates — opcional.
  EXCHANGE_RATE_API_KEY: optionalString(z.string()),

  // Observability — opcional.
  SENTRY_DSN: optionalString(z.string()),

  // Cron — requerido.
  CRON_SECRET: z.string().min(32),
})

/**
 * Public (NEXT_PUBLIC_*) environment variables.
 * Disponibles en cliente y servidor.
 */
const publicSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1),
})

const isServer = typeof window === 'undefined'

/**
 * Durante el build de Next.js (`next build`, `phase-production-build`), las env
 * vars de Vercel pueden no estar disponibles todavía si el deploy se hizo antes
 * de configurarlas. Saltamos validación estricta en ese caso para que el build
 * pase y el deploy quede listo; el runtime sí valida al primer acceso.
 *
 * También se respeta `SKIP_ENV_VALIDATION=1` (convención Next.js).
 */
const skipValidation =
  process.env.SKIP_ENV_VALIDATION === '1' ||
  process.env.NEXT_PHASE === 'phase-production-build'

const publicEnv = {
  NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
}

const publicParsed = publicSchema.safeParse(publicEnv)

if (!publicParsed.success && !skipValidation) {
  console.error('Variables públicas inválidas:', z.treeifyError(publicParsed.error))
  throw new Error('Variables públicas inválidas. Revisa .env.local.')
}

type ServerEnv = z.infer<typeof serverSchema>
type PublicEnv = z.infer<typeof publicSchema>
type Env = ServerEnv & PublicEnv

let serverParsed: ServerEnv | null = null

if (isServer) {
  const result = serverSchema.safeParse(process.env)
  if (!result.success) {
    if (!skipValidation) {
      console.error('Variables de entorno inválidas:', z.treeifyError(result.error))
      throw new Error('Variables de entorno inválidas. Revisa .env.local.')
    }
    // Build-time: log y continúa con `process.env` crudo. El runtime fallará
    // si alguna se usa sin estar definida — pero el build NO bloquea el deploy.
    console.warn('[env] Validación saltada (build phase). Verifica las env vars en Vercel.')
  } else {
    serverParsed = result.data
  }
}

export const env: Env = new Proxy({} as Env, {
  get(_target, key: string) {
    if (key.startsWith('NEXT_PUBLIC_')) {
      if (publicParsed.success) {
        return publicParsed.data[key as keyof PublicEnv]
      }
      return process.env[key] as string | undefined
    }
    if (!isServer) {
      throw new Error(
        `Intento de leer la variable de servidor "${key}" desde el cliente.`,
      )
    }
    if (serverParsed) {
      return serverParsed[key as keyof ServerEnv]
    }
    // Fallback build-time: lee directo de process.env sin validación.
    return process.env[key]
  },
})
