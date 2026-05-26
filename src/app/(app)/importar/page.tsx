import type { Metadata } from 'next'

import { requireCurrentUser } from '@/lib/auth'
import { listUserAccountsBasic } from '@/lib/db/queries/transactions'
import {
  listImportBatchesForUser,
  type ImportBatchItem,
} from '@/lib/db/queries/imports'
import { EmptyState } from '@/components/app/empty-state'
import { ImporterClient } from './importer-client'

export const metadata: Metadata = {
  title: 'Importar',
}

export default async function ImportarPage() {
  const user = await requireCurrentUser()
  const [accounts, batches] = await Promise.all([
    listUserAccountsBasic(user.id),
    listImportBatchesForUser(user.id, 12),
  ])

  return (
    <div className="flex min-w-0 flex-col gap-10">
      <header className="flex min-w-0 flex-col gap-1">
        <p className="text-text-secondary text-sm">Importar</p>
        <h1 className="text-text text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">
          Extracto bancario
        </h1>
        <p className="text-text-tertiary mt-3 max-w-xl text-sm leading-relaxed">
          Carga un CSV de tu banco. Finanzia detecta las columnas, deja que
          ajustes el mapeo y crea las transacciones sobre la cuenta que elijas.
        </p>
      </header>

      <ImporterClient accounts={accounts} />

      <section className="flex flex-col gap-4">
        <h2 className="text-text text-sm font-semibold">Imports recientes</h2>
        {batches.length === 0 ? (
          <EmptyState
            headline="Aún no has cargado ningún extracto."
            body="Cuando importes uno, aparecerá aquí con el conteo de filas procesadas y omitidas."
          />
        ) : (
          <>
            {/* Mobile (<md): cards apiladas */}
            <ul className="flex flex-col gap-2 md:hidden">
              {batches.map((b) => (
                <li
                  key={b.id}
                  className="border-border-default bg-surface flex min-w-0 flex-col gap-2 rounded-[12px] border p-4"
                >
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <span className="text-text truncate text-[14px]">{b.filename}</span>
                    <StatusBadge status={b.status} />
                  </div>
                  <div className="text-text-tertiary flex items-center justify-between gap-3 text-[11px]">
                    <span className="truncate">
                      {formatDate(b.createdAt)} · {b.accountName}
                    </span>
                    <span className="tabular shrink-0">
                      {b.importedRows.toLocaleString('es-CO')} / {b.totalRows.toLocaleString('es-CO')}
                      {b.totalRows - b.importedRows > 0 && (
                        <span className="text-warning ml-1">
                          ({(b.totalRows - b.importedRows).toLocaleString('es-CO')} omitidas)
                        </span>
                      )}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
            {/* Desktop (>=md): tabla */}
            <div className="border-border-default bg-surface hidden overflow-hidden rounded-[12px] border md:block">
              <table className="w-full">
                <thead>
                  <tr className="border-border-default text-text-tertiary border-b text-[11px] uppercase tracking-[0.08em]">
                    <th className="px-5 py-3 text-left font-medium">Fecha</th>
                    <th className="px-5 py-3 text-left font-medium">Archivo</th>
                    <th className="px-5 py-3 text-left font-medium">Cuenta</th>
                    <th className="px-5 py-3 text-right font-medium">Filas</th>
                    <th className="px-5 py-3 text-right font-medium">Omitidas</th>
                    <th className="px-5 py-3 text-right font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((b) => (
                    <BatchRow key={b.id} batch={b} />
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function BatchRow({ batch }: { batch: ImportBatchItem }) {
  const omitted = batch.totalRows - batch.importedRows
  return (
    <tr className="border-border-default/60 border-b last:border-b-0">
      <td className="text-text-secondary tabular px-5 py-3.5 text-[13px]">
        {formatDate(batch.createdAt)}
      </td>
      <td className="text-text px-5 py-3.5 text-sm">{batch.filename}</td>
      <td className="text-text-secondary px-5 py-3.5 text-sm">
        {batch.accountName}
      </td>
      <td className="text-text tabular px-5 py-3.5 text-right text-sm">
        {batch.importedRows.toLocaleString('es-CO')}
        <span className="text-text-tertiary ml-1">
          / {batch.totalRows.toLocaleString('es-CO')}
        </span>
      </td>
      <td className="tabular px-5 py-3.5 text-right text-sm">
        {omitted > 0 ? (
          <span className="text-warning">{omitted.toLocaleString('es-CO')}</span>
        ) : (
          <span className="text-text-tertiary">0</span>
        )}
      </td>
      <td className="px-5 py-3.5 text-right">
        <StatusBadge status={batch.status} />
      </td>
    </tr>
  )
}

function StatusBadge({ status }: { status: ImportBatchItem['status'] }) {
  const map: Record<
    ImportBatchItem['status'],
    { label: string; tone: string }
  > = {
    pending: { label: 'En cola', tone: 'text-text-tertiary' },
    processing: { label: 'Procesando', tone: 'text-text-secondary' },
    completed: { label: 'Completado', tone: 'text-positive' },
    failed: { label: 'Fallido', tone: 'text-negative' },
  }
  const { label, tone } = map[status]
  return <span className={`text-[12px] ${tone}`}>{label}</span>
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('es-CO', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}
