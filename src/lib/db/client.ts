import 'server-only'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { env } from '@/lib/env'
import * as schema from './schema'

const globalForDb = globalThis as unknown as {
  queryClient?: ReturnType<typeof postgres>
}

const queryClient =
  globalForDb.queryClient ??
  postgres(env.DATABASE_URL, {
    prepare: false,
    max: 10,
    idle_timeout: 20,
    max_lifetime: 60 * 30,
  })

if (env.NODE_ENV !== 'production') globalForDb.queryClient = queryClient

export const db = drizzle(queryClient, { schema, casing: 'snake_case' })
export { schema }
export type Db = typeof db
