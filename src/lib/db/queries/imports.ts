import 'server-only'
import { desc, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { accounts, importBatches } from '@/lib/db/schema'

export type ImportRowError = { row: number; reason: string }

export type ImportBatchItem = {
  id: string
  filename: string
  totalRows: number
  importedRows: number
  status: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: Date
  completedAt: Date | null
  accountName: string
  errors: number
  /** Filas omitidas con su motivo (sin el row crudo). Capadas a 50 al guardar. */
  errorDetails: ImportRowError[]
}

export async function listImportBatchesForUser(
  userId: string,
  limit = 20,
): Promise<ImportBatchItem[]> {
  const rows = await db
    .select({
      id: importBatches.id,
      filename: importBatches.filename,
      totalRows: importBatches.totalRows,
      importedRows: importBatches.importedRows,
      status: importBatches.status,
      createdAt: importBatches.createdAt,
      completedAt: importBatches.completedAt,
      accountName: accounts.name,
      errors: importBatches.errors,
    })
    .from(importBatches)
    .leftJoin(accounts, eq(accounts.id, importBatches.accountId))
    .where(eq(importBatches.userId, userId))
    .orderBy(desc(importBatches.createdAt))
    .limit(limit)

  return rows.map((r) => {
    const rawErrors = Array.isArray(r.errors)
      ? (r.errors as Array<{ row?: unknown; reason?: unknown }>)
      : []
    const errorDetails: ImportRowError[] = rawErrors
      .filter((e) => typeof e?.row === 'number' && typeof e?.reason === 'string')
      .map((e) => ({ row: e.row as number, reason: e.reason as string }))
    return {
      id: r.id,
      filename: r.filename,
      totalRows: r.totalRows,
      importedRows: r.importedRows,
      status: r.status,
      createdAt: r.createdAt,
      completedAt: r.completedAt,
      accountName: r.accountName ?? '—',
      errors: rawErrors.length,
      errorDetails,
    }
  })
}
