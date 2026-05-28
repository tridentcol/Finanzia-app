import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { emailInboxAliases, transactions, accounts } from '@/lib/db/schema'
import { env } from '@/lib/env'
import { parseBancolombiaEmail } from '@/lib/email-parsers/bancolombia'
import { getRate } from '@/lib/currency/rates'

/**
 * Resend Inbound Email webhook.
 * Resend POST-ea un JSON con {from, to, subject, text, html}.
 * El alias en el campo `to` identifica al usuario y el banco.
 *
 * Verificación: X-Resend-Signature header contra HMAC-SHA256 del payload
 * usando RESEND_WEBHOOK_SECRET. Si la env var no está configurada, el
 * endpoint devuelve 503 (feature deshabilitada).
 */
export async function POST(req: Request): Promise<Response> {
  const secret = env.RESEND_WEBHOOK_SECRET
  if (!secret) {
    return NextResponse.json({ error: 'Email inbox not configured.' }, { status: 503 })
  }

  const rawBody = await req.text()

  // Verify HMAC signature
  const sig = req.headers.get('svix-signature') ?? req.headers.get('x-resend-signature')
  if (!sig) {
    return NextResponse.json({ error: 'Missing signature.' }, { status: 401 })
  }

  const isValid = await verifyHmac(rawBody, sig, secret)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const to = String(payload.to ?? '')
  const subject = String(payload.subject ?? '')
  const body = String(payload.text ?? payload.html ?? '')

  // Extract alias slug from recipient address (e.g. "abc123@inbox.finanzia.app")
  const aliasSlug = to.split('@')[0]?.toLowerCase()
  if (!aliasSlug) {
    return NextResponse.json({ error: 'Invalid recipient.' }, { status: 400 })
  }

  // Look up alias
  const [alias] = await db
    .select()
    .from(emailInboxAliases)
    .where(and(eq(emailInboxAliases.aliasSlug, aliasSlug), eq(emailInboxAliases.active, true)))
    .limit(1)

  if (!alias) {
    return NextResponse.json({ error: 'Unknown alias.' }, { status: 404 })
  }

  if (!alias.accountId) {
    return NextResponse.json({ error: 'Alias has no linked account.' }, { status: 422 })
  }

  // Get account currency
  const [acct] = await db
    .select({ currency: accounts.currency, userId: accounts.userId })
    .from(accounts)
    .where(and(eq(accounts.id, alias.accountId), eq(accounts.userId, alias.userId)))
    .limit(1)

  if (!acct) {
    return NextResponse.json({ error: 'Account not found.' }, { status: 404 })
  }

  // Parse email based on bank
  let parsed: ReturnType<typeof parseBancolombiaEmail> | null = null
  if (alias.bank === 'bancolombia') {
    parsed = parseBancolombiaEmail(subject, body)
  }

  if (!parsed || !parsed.ok) {
    return NextResponse.json(
      { error: parsed?.reason ?? 'Unsupported bank parser.' },
      { status: 422 },
    )
  }

  const tx = parsed.data
  const today = new Date().toISOString().slice(0, 10)

  // Compute base amount if currencies differ
  const baseCurrency = acct.currency
  let amountBase = tx.amount
  let exchangeRate = '1'

  if (tx.currency !== baseCurrency) {
    try {
      const rate = await getRate(tx.currency, baseCurrency, today)
      if (rate) {
        amountBase = (Number.parseFloat(tx.amount) * Number.parseFloat(rate)).toFixed(2)
        exchangeRate = rate
      }
    } catch {
      amountBase = tx.amount
    }
  }

  await db.insert(transactions).values({
    userId: alias.userId,
    accountId: alias.accountId,
    kind: tx.kind,
    date: tx.date,
    amountOriginal: tx.amount,
    currency: tx.currency,
    amountBase,
    exchangeRate,
    description: tx.description,
    merchant: tx.merchant,
    notes: `Importado desde email (${alias.bank})`,
  })

  return NextResponse.json({ ok: true })
}

async function verifyHmac(
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  try {
    const enc = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    )
    // Signature may be prefixed "sha256=" or "v1,"
    const rawSig = signature.replace(/^(sha256=|v1,)/, '')
    const sigBytes = hexToUint8Array(rawSig).buffer as ArrayBuffer
    return await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payload))
  } catch {
    return false
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const pairs = hex.match(/.{1,2}/g) ?? []
  return new Uint8Array(pairs.map((b) => Number.parseInt(b, 16)))
}
