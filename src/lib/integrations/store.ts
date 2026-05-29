import 'server-only'
import { and, eq, sql } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { userIntegrations } from '@/lib/db/schema'

export type Provider = 'anthropic' | 'openai'

/**
 * Default scopes por provider. OpenAI es el cerebro del copiloto por defecto
 * (chat) además de los embeddings, así que pre-seleccionamos ambos; el usuario
 * puede desmarcar. Anthropic sólo expone chat.
 */
export const DEFAULT_SCOPES: Record<Provider, string[]> = {
  anthropic: ['chat'],
  openai: ['embed', 'chat'],
}

export const AVAILABLE_SCOPES: Record<Provider, string[]> = {
  anthropic: ['chat'],
  openai: ['embed', 'chat'],
}

export type IntegrationSummary = {
  provider: Provider
  status: 'active' | 'invalid' | 'disabled'
  scopes: string[]
  lastValidatedAt: Date | null
  createdAt: Date
}

/**
 * Devuelve los providers que el usuario tiene configurados. NO incluye la
 * key plaintext — sólo metadatos seguros para UI.
 */
export async function listUserIntegrations(
  userId: string,
): Promise<IntegrationSummary[]> {
  const rows = await db
    .select({
      provider: userIntegrations.provider,
      status: userIntegrations.status,
      scopes: userIntegrations.scopes,
      lastValidatedAt: userIntegrations.lastValidatedAt,
      createdAt: userIntegrations.createdAt,
    })
    .from(userIntegrations)
    .where(eq(userIntegrations.userId, userId))

  return rows.map((r) => ({
    provider: r.provider as Provider,
    status: r.status,
    scopes: r.scopes ?? [],
    lastValidatedAt: r.lastValidatedAt,
    createdAt: r.createdAt,
  }))
}

/**
 * Crea o actualiza la integración. La key se guarda EN Vault y aquí sólo
 * persistimos el secret_id. Idempotente: si ya existe, reusa secret_id
 * (actualiza el contenido) y refresca scopes/status.
 */
export async function upsertIntegration(args: {
  userId: string
  provider: Provider
  apiKey: string
  scopes: string[]
}): Promise<void> {
  const secretName = `finanzia.${args.provider}.${args.userId}`

  // ¿Existe ya un secret_id para este (user, provider)?
  const [existing] = await db
    .select({ secretId: userIntegrations.secretId })
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, args.userId),
        eq(userIntegrations.provider, args.provider),
      ),
    )
    .limit(1)

  if (existing) {
    // Actualiza el secreto existente sin tocar la fila.
    await db.execute(sql`
      SELECT vault.update_secret(${existing.secretId}::uuid, ${args.apiKey}, ${secretName}, '')
    `)
    await db
      .update(userIntegrations)
      .set({
        scopes: args.scopes,
        status: 'active',
        lastValidatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(userIntegrations.userId, args.userId),
          eq(userIntegrations.provider, args.provider),
        ),
      )
    return
  }

  // Crear un nuevo secreto y persistir la fila.
  const rows = await db.execute<{ create_secret: string }>(sql`
    SELECT vault.create_secret(${args.apiKey}, ${secretName}, '')
  `)
  const secretId = rows[0]?.create_secret
  if (!secretId) {
    throw new Error('No se pudo crear el secreto en Vault.')
  }

  await db.insert(userIntegrations).values({
    userId: args.userId,
    provider: args.provider,
    secretId,
    scopes: args.scopes,
    status: 'active',
    lastValidatedAt: new Date(),
  })
}

/**
 * Elimina la integración + su secreto de Vault. Idempotente: si no existe,
 * no falla.
 */
export async function removeIntegration(args: {
  userId: string
  provider: Provider
}): Promise<void> {
  const [existing] = await db
    .select({ secretId: userIntegrations.secretId })
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, args.userId),
        eq(userIntegrations.provider, args.provider),
      ),
    )
    .limit(1)

  if (!existing) return

  await db
    .delete(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, args.userId),
        eq(userIntegrations.provider, args.provider),
      ),
    )
  await db.execute(sql`DELETE FROM vault.secrets WHERE id = ${existing.secretId}::uuid`)
}

/**
 * Lee la API key plaintext del Vault. SOLO server-side. Devuelve null si no
 * hay integración activa o si la query a Vault falla.
 *
 * El `requiredScope` filtra: por ejemplo, sólo retorna la key de OpenAI si
 * el usuario habilitó scope 'embed' para esa key.
 */
export async function getUserApiKey(args: {
  userId: string
  provider: Provider
  requiredScope?: string
}): Promise<string | null> {
  const [row] = await db
    .select({
      secretId: userIntegrations.secretId,
      scopes: userIntegrations.scopes,
      status: userIntegrations.status,
    })
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, args.userId),
        eq(userIntegrations.provider, args.provider),
        eq(userIntegrations.status, 'active'),
      ),
    )
    .limit(1)

  if (!row) return null
  if (args.requiredScope && !row.scopes.includes(args.requiredScope)) {
    return null
  }

  try {
    const result = await db.execute<{ decrypted_secret: string }>(sql`
      SELECT decrypted_secret
      FROM vault.decrypted_secrets
      WHERE id = ${row.secretId}::uuid
      LIMIT 1
    `)
    return result[0]?.decrypted_secret ?? null
  } catch (err) {
    console.error('[integrations] vault read falló:', err)
    return null
  }
}

/**
 * Reporta si el usuario tiene al menos UN provider de chat configurado.
 * Útil para el copiloto: si false → modo heurístico.
 */
export async function hasChatProvider(userId: string): Promise<boolean> {
  const row = await db
    .select({ provider: userIntegrations.provider })
    .from(userIntegrations)
    .where(
      and(
        eq(userIntegrations.userId, userId),
        eq(userIntegrations.status, 'active'),
        sql`'chat' = ANY(${userIntegrations.scopes})`,
      ),
    )
    .limit(1)
  return row.length > 0
}
