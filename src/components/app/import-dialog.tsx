'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { icons } from '@/lib/design/icons'
import { ImporterClient } from './importer-client'
import type { ImportBatchItem } from '@/lib/db/queries/imports'

type Account = { id: string; name: string; currency: string }

type Props = {
  accounts: Account[]
  batches: ImportBatchItem[]
}

/**
 * Dialog que aloja el importador de CSV. Reemplaza a la ruta `/importar` —
 * el redirect 308 desde `/importar` apunta a `/mi-dinero/movimientos?import=open`
 * y este componente lee `?import` directamente del URL para decidir si está
 * abierto.
 *
 * URL-driven en vez de useState: el browser back-button cierra el dialog, los
 * Links de Cmd+K/sheet lo abren sin necesidad de stores, y no hay
 * sincronización en effects (React Compiler queda contento).
 */
export function ImportDialog({ accounts, batches }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const open = searchParams.get('import') === 'open'

  function withImportParam(next: boolean): string {
    const params = new URLSearchParams(searchParams.toString())
    if (next) params.set('import', 'open')
    else params.delete('import')
    const qs = params.toString()
    return qs ? `${pathname}?${qs}` : pathname
  }

  function handleOpenChange(next: boolean) {
    router.replace(withImportParam(next), { scroll: false })
  }

  const Upload = icons.upload

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => router.replace(withImportParam(true), { scroll: false })}
      >
        <Upload strokeWidth={1.5} className="size-[14px]" />
        Importar CSV
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Importar extracto bancario</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-8">
            <ImporterClient
              accounts={accounts}
              onComplete={() =>
                router.replace(withImportParam(false), { scroll: false })
              }
            />

            {batches.length > 0 && (
              <section className="flex flex-col gap-3">
                <h3 className="text-text-secondary text-[11px] font-medium uppercase tracking-[0.1em]">
                  Imports recientes
                </h3>
                <ul className="flex flex-col">
                  {batches.slice(0, 6).map((b) => {
                    const omitted = b.totalRows - b.importedRows
                    const summary = (
                      <div className="flex items-center justify-between gap-3 py-2.5 text-[12px]">
                        <div className="flex min-w-0 flex-col">
                          <span className="text-text truncate">{b.filename}</span>
                          <span className="text-text-tertiary truncate text-[11px]">
                            {b.accountName} · {formatDate(b.createdAt)}
                          </span>
                        </div>
                        <div className="text-text-tertiary shrink-0 text-right text-[11px] tabular">
                          {b.importedRows.toLocaleString('es-CO')} /{' '}
                          {b.totalRows.toLocaleString('es-CO')}
                          {omitted > 0 && (
                            <span className="text-warning ml-1">
                              ({omitted.toLocaleString('es-CO')})
                            </span>
                          )}
                        </div>
                      </div>
                    )
                    return (
                      <li
                        key={b.id}
                        className="border-border-default/60 border-b last:border-b-0"
                      >
                        {b.errorDetails.length > 0 ? (
                          <details className="group">
                            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-[6px] outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40">
                              <span className="flex-1">{summary}</span>
                              <ChevronToggle />
                            </summary>
                            <ul className="text-text-tertiary flex flex-col gap-1 pb-3 pl-1 text-[11px]">
                              {b.errorDetails.map((e, i) => (
                                <li key={i} className="flex gap-2">
                                  <span className="tabular shrink-0">Fila {e.row + 1}</span>
                                  <span className="text-text-secondary">{e.reason}</span>
                                </li>
                              ))}
                              {omitted > b.errorDetails.length && (
                                <li className="text-text-tertiary italic">
                                  {(omitted - b.errorDetails.length).toLocaleString('es-CO')}{' '}
                                  más omitidas por duplicado o ya importadas.
                                </li>
                              )}
                            </ul>
                          </details>
                        ) : (
                          summary
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function ChevronToggle() {
  const Chevron = icons['chevron-down']
  return (
    <Chevron
      strokeWidth={1.5}
      className="text-text-tertiary size-3.5 shrink-0 transition-transform group-open:rotate-180"
      aria-hidden
    />
  )
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
