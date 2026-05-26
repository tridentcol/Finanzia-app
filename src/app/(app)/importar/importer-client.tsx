'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Papa from 'papaparse'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Field } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { runImport } from './actions'
import {
  inferColumns,
  importFieldLabels,
  type ColumnMapping,
  type ImportField,
} from '@/lib/import/infer-columns'
import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

type Account = { id: string; name: string; currency: string }

const NONE = '__none__'

export function ImporterClient({ accounts }: { accounts: Account[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [file, setFile] = useState<File | null>(null)
  const [filename, setFilename] = useState('')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<Record<string, unknown>[]>([])
  const [preview, setPreview] = useState<Record<string, unknown>[]>([])
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [mapping, setMapping] = useState<ColumnMapping>({})
  const [headerRow, setHeaderRow] = useState(0)
  const [parseError, setParseError] = useState<string | null>(null)
  const [dragActive, setDragActive] = useState(false)

  function reset() {
    setFile(null)
    setFilename('')
    setHeaders([])
    setRows([])
    setPreview([])
    setMapping({})
    setHeaderRow(0)
    setParseError(null)
  }

  function onPickFile(f: File) {
    setParseError(null)
    setFile(f)
    setFilename(f.name)
    Papa.parse<Record<string, unknown>>(f, {
      header: false,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setParseError(result.errors[0]?.message ?? 'Error al parsear CSV.')
          return
        }
        const data = result.data as unknown as string[][]
        if (data.length === 0) {
          setParseError('Archivo vacío.')
          return
        }
        applyHeaderRow(data, 0)
      },
      error: (err) => {
        setParseError(err.message)
      },
    })
  }

  function applyHeaderRow(allRows: string[][], hrow: number) {
    if (hrow >= allRows.length) return
    const headersRaw = allRows[hrow]!.map((h) => String(h ?? '').trim())
    const dataRows = allRows.slice(hrow + 1).map((r) => {
      const obj: Record<string, unknown> = {}
      headersRaw.forEach((h, idx) => {
        obj[h] = r[idx] ?? ''
      })
      return obj
    })
    setHeaderRow(hrow)
    setHeaders(headersRaw)
    setRows(dataRows)
    setPreview(dataRows.slice(0, 5))
    setMapping(inferColumns(headersRaw))
  }

  function onFieldChange(field: ImportField, value: string) {
    setMapping((prev) => {
      const next = { ...prev }
      if (value === NONE) {
        delete next[field]
      } else {
        next[field] = value
      }
      return next
    })
  }

  function canImport(): boolean {
    if (!accountId) return false
    if (!mapping.date || !mapping.description) return false
    if (!mapping.amountSigned && !(mapping.amountIncome || mapping.amountExpense)) return false
    if (rows.length === 0) return false
    return true
  }

  function onImport() {
    if (!canImport()) return
    startTransition(async () => {
      const result = await runImport({
        accountId,
        filename,
        mapping: mapping as Record<string, string>,
        rows,
      })
      if (!result.ok) {
        toast.error(result.error.message)
        return
      }
      const { imported, skipped } = result.data
      if (skipped > 0) {
        toast.success(`${imported} importadas · ${skipped} omitidas.`)
      } else {
        toast.success(`${imported} transacciones importadas.`)
      }
      router.refresh()
      reset()
    })
  }

  if (accounts.length === 0) {
    return (
      <div className="border-border-default bg-surface rounded-[12px] border p-10 text-sm">
        <p className="editorial text-text text-2xl leading-tight">
          Necesitas al menos una cuenta antes de importar.
        </p>
        <p className="text-text-secondary mt-3 max-w-md text-sm">
          Crea una cuenta primero. Luego podrás cargar el extracto sobre ella.
        </p>
      </div>
    )
  }

  const Upload = icons.upload
  const X = icons.x

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Cuenta destino">
          <Select value={accountId} onValueChange={setAccountId}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona" />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name} · {a.currency}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {headers.length > 0 && (
          <Field
            label="Fila del encabezado"
            hint="Algunos extractos tienen metadatos arriba; ajusta si los headers no son los correctos"
          >
            <Input
              type="number"
              min={0}
              value={headerRow}
              onChange={(e) => {
                if (!file) return
                const n = Number.parseInt(e.target.value, 10)
                if (Number.isNaN(n)) return
                Papa.parse<string[]>(file, {
                  header: false,
                  skipEmptyLines: true,
                  complete: (r) =>
                    applyHeaderRow(r.data as unknown as string[][], Math.max(0, n)),
                })
              }}
              className="tabular w-24"
            />
          </Field>
        )}
      </div>

      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragActive(true)
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragActive(false)
          const f = e.dataTransfer.files[0]
          if (f) onPickFile(f)
        }}
        className={cn(
          'border-border-default flex cursor-pointer flex-col items-center gap-2 rounded-[12px] border border-dashed px-8 py-12 text-center transition-colors',
          dragActive
            ? 'border-border-emphasis bg-surface-hover/40'
            : 'bg-surface hover:bg-surface-hover/30',
        )}
      >
        <Upload strokeWidth={1.5} className="text-text-tertiary h-6 w-6" />
        <p className="text-text text-sm">
          {file ? filename : 'Arrastra el CSV aquí o haz click para elegir'}
        </p>
        <p className="text-text-tertiary text-[12px]">
          {file
            ? `${rows.length} filas detectadas`
            : 'Formatos: extractos bancarios CSV (papaparse autodetecta el delimiter)'}
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onPickFile(f)
          }}
        />
      </label>

      {parseError && <p className="text-negative text-sm">{parseError}</p>}

      {headers.length > 0 && (
        <section className="flex flex-col gap-4">
          <h2 className="text-text text-sm font-semibold">Mapeo de columnas</h2>
          <p className="text-text-tertiary text-xs">
            Finanzia infirió esto del nombre de las columnas. Ajusta lo que sea
            necesario. Debes tener al menos fecha, descripción y un monto.
          </p>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {importFieldLabels.map(({ field, label, required }) => (
              <li key={field}>
                <Field
                  label={label + (required ? ' *' : '')}
                  hint={required ? 'Requerido' : 'Opcional'}
                >
                  <Select
                    value={mapping[field] ?? NONE}
                    onValueChange={(v) => onFieldChange(field, v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Sin mapear" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Sin mapear</SelectItem>
                      {headers.map((h, idx) => (
                        <SelectItem key={`${h}-${idx}`} value={h}>
                          {h || `(columna ${idx + 1})`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </li>
            ))}
          </ul>
        </section>
      )}

      {preview.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-text text-sm font-semibold">
            Vista previa ({preview.length} filas)
          </h2>
          <div className="border-border-default bg-surface overflow-x-auto rounded-[12px] border">
            <table className="w-full">
              <thead>
                <tr className="border-border-default text-text-tertiary border-b text-[11px] uppercase tracking-[0.08em]">
                  {headers.map((h, idx) => (
                    <th key={`${h}-${idx}`} className="px-4 py-2 text-left font-medium">
                      {h || `Col ${idx + 1}`}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, idx) => (
                  <tr key={idx} className="border-border-default/60 border-b last:border-b-0">
                    {headers.map((h, i) => (
                      <td
                        key={`${h}-${i}`}
                        className="text-text-secondary px-4 py-2 text-[12px]"
                      >
                        {String(row[h] ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <div className="flex items-center justify-between gap-3">
        {file && (
          <Button variant="ghost" onClick={reset} disabled={pending}>
            <X strokeWidth={1.5} className="size-4" />
            Cancelar
          </Button>
        )}
        <Button onClick={onImport} disabled={!canImport() || pending}>
          {pending ? 'Importando…' : `Importar ${rows.length || ''} filas`}
        </Button>
      </div>
    </div>
  )
}
