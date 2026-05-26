/**
 * Heurística para inferir qué columna del CSV corresponde a cada campo de
 * transacción. Caso de uso: extractos bancarios colombianos / LATAM que vienen
 * con headers en español o inglés y orden inconsistente.
 *
 * La heurística es deliberadamente conservadora — si no encuentra match con
 * alta confianza, devuelve null y el usuario asigna manualmente.
 */

export type ImportField =
  | 'date'
  | 'description'
  | 'amountSigned' // monto con signo (negativo = expense, positivo = income)
  | 'amountIncome' // columna solo de ingresos
  | 'amountExpense' // columna solo de egresos
  | 'merchant'
  | 'category'

const patterns: Record<ImportField, RegExp[]> = {
  date: [
    /^fecha/i,
    /^date$/i,
    /^día$/i,
    /^dia$/i,
    /transacci[oó]n.*fecha/i,
    /fecha.*transacci[oó]n/i,
    /posting.?date/i,
  ],
  description: [
    /^descripci[oó]n/i,
    /^detalle/i,
    /^concepto/i,
    /^description$/i,
    /^memo$/i,
    /^narration$/i,
  ],
  amountSigned: [
    /^monto$/i,
    /^valor$/i,
    /^amount$/i,
    /^importe$/i,
    /^transaction.?amount$/i,
  ],
  amountIncome: [
    /^abono/i,
    /^ingreso/i,
    /^cr[eé]dito$/i,
    /^credit$/i,
    /^deposit/i,
  ],
  amountExpense: [
    /^cargo/i,
    /^d[eé]bito$/i,
    /^debit$/i,
    /^gasto$/i,
    /^withdrawal/i,
  ],
  merchant: [/^comercio/i, /^merchant/i, /^establecimiento/i, /^payee/i],
  category: [/^categor[ií]a/i, /^category$/i, /^tipo/i],
}

export type ColumnMapping = Partial<Record<ImportField, string>>

/**
 * Recibe los headers del CSV y devuelve un mapping sugerido.
 * Las columnas no reconocidas quedan sin mapear.
 */
export function inferColumns(headers: string[]): ColumnMapping {
  const mapping: ColumnMapping = {}
  const used = new Set<string>()

  for (const [fieldRaw, regexes] of Object.entries(patterns)) {
    const field = fieldRaw as ImportField
    const match = headers.find(
      (h) => !used.has(h) && regexes.some((re) => re.test(h.trim())),
    )
    if (match) {
      mapping[field] = match
      used.add(match)
    }
  }

  return mapping
}

/**
 * Lista de campos disponibles para mapear en la UI. Orden = importancia.
 */
export const importFieldLabels: Array<{ field: ImportField; label: string; required: boolean }> = [
  { field: 'date', label: 'Fecha', required: true },
  { field: 'description', label: 'Descripción', required: true },
  { field: 'amountSigned', label: 'Monto (con signo)', required: false },
  { field: 'amountIncome', label: 'Columna de ingreso', required: false },
  { field: 'amountExpense', label: 'Columna de egreso', required: false },
  { field: 'merchant', label: 'Comercio', required: false },
  { field: 'category', label: 'Categoría (texto)', required: false },
]
