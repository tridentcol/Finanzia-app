import { NextResponse } from 'next/server'

import { requireCurrentUser } from '@/lib/auth'
import { countUnreadAlerts } from '@/lib/db/queries/alerts'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await requireCurrentUser()
    const count = await countUnreadAlerts(user.id)
    return NextResponse.json({ count })
  } catch {
    return NextResponse.json({ count: 0 }, { status: 401 })
  }
}
