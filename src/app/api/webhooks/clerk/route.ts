import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { Webhook } from 'svix'
import type { UserJSON, WebhookEvent } from '@clerk/nextjs/server'

import { env } from '@/lib/env'
import { db } from '@/lib/db/client'
import { profiles, users } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  if (!env.CLERK_WEBHOOK_SECRET) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: 'webhook_not_configured',
          message: 'CLERK_WEBHOOK_SECRET no está definido.',
        },
      },
      { status: 503 },
    )
  }

  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json(
      { ok: false, error: { code: 'missing_headers', message: 'Cabeceras svix ausentes.' } },
      { status: 400 },
    )
  }

  const body = await req.text()
  const wh = new Webhook(env.CLERK_WEBHOOK_SECRET)

  let evt: WebhookEvent
  try {
    evt = wh.verify(body, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as WebhookEvent
  } catch (err) {
    console.error('Firma de webhook inválida.', err)
    return NextResponse.json(
      { ok: false, error: { code: 'invalid_signature', message: 'Firma inválida.' } },
      { status: 401 },
    )
  }

  try {
    if (evt.type === 'user.created' || evt.type === 'user.updated') {
      const data = evt.data as UserJSON
      const email = primaryEmail(data)
      if (!email) {
        return NextResponse.json(
          { ok: false, error: { code: 'missing_email', message: 'Usuario sin email primario.' } },
          { status: 422 },
        )
      }
      const name = composedName(data)

      const [user] = await db
        .insert(users)
        .values({ clerkId: data.id, email, name })
        .onConflictDoUpdate({
          target: users.clerkId,
          set: { email, name, updatedAt: new Date() },
        })
        .returning({ id: users.id })

      if (user && evt.type === 'user.created') {
        await db.insert(profiles).values({ userId: user.id }).onConflictDoNothing()
      }
    } else if (evt.type === 'user.deleted') {
      const clerkId = evt.data.id
      if (clerkId) {
        await db.delete(users).where(eq(users.clerkId, clerkId))
      }
    }
    // Otros eventos: aceptamos sin acción para que Clerk no reintente.

    return NextResponse.json({ ok: true, data: { received: evt.type } })
  } catch (err) {
    console.error('Error procesando webhook Clerk.', err)
    return NextResponse.json(
      { ok: false, error: { code: 'internal_error', message: 'Error interno.' } },
      { status: 500 },
    )
  }
}

function primaryEmail(data: UserJSON): string | null {
  const primary = data.email_addresses.find((e) => e.id === data.primary_email_address_id)
  const fallback = data.email_addresses[0]
  return primary?.email_address ?? fallback?.email_address ?? null
}

function composedName(data: UserJSON): string | null {
  const first = data.first_name?.trim()
  const last = data.last_name?.trim()
  const composed = [first, last].filter(Boolean).join(' ')
  return composed.length > 0 ? composed : null
}
