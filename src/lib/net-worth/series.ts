/**
 * Reconstrucción del patrimonio neto en el tiempo a partir del flujo mensual.
 *
 * Idea central: el patrimonio neto cambia EXACTAMENTE por el flujo neto
 * (ingreso − gasto) de cada transacción. Las transferencias entre cuentas
 * propias y los movimientos de principal de deuda son neutros al patrimonio
 * (mueven un activo y un pasivo por igual). Por eso, conociendo el neto de HOY
 * y el flujo (ingreso − gasto) de cada mes, podemos reconstruir el neto al
 * cierre de cada mes pasado sin caminar saldos por cuenta ni tasas históricas:
 *
 *   neto(fin de mes M) = netoHoy − Σ flujo(meses posteriores a M)
 *
 * Aproximación conocida: no captura intereses de deuda que no sean una
 * transacción (sobreestima levemente el pasado). Suficiente para una tendencia.
 */

export type MonthFlow = {
  /** 'YYYY-MM'. */
  month: string
  /** Ingreso − gasto del mes, en moneda base. */
  flow: number
}

export type NetPoint = {
  /** 'YYYY-MM-DD' (fin de mes). */
  date: string
  /** Patrimonio neto reconstruido en moneda base. */
  net: number
}

const round2 = (n: number) => Math.round(n * 100) / 100

/** Último día de un mes 'YYYY-MM' como 'YYYY-MM-DD' (UTC, determinista). */
export function endOfMonthIso(month: string): string {
  const [y, m] = month.split('-').map((s) => Number.parseInt(s, 10))
  // Día 0 del mes siguiente = último día de este mes.
  const d = new Date(Date.UTC(y!, m!, 0))
  return d.toISOString().slice(0, 10)
}

/** Secuencia contigua de meses ['YYYY-MM'] desde `start` hasta `endExclusive` (sin incluirlo). */
export function monthSequence(start: string, endExclusive: string): string[] {
  const out: string[] = []
  let [y, m] = start.split('-').map((s) => Number.parseInt(s, 10)) as [number, number]
  while (`${y}-${String(m).padStart(2, '0')}` < endExclusive) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m += 1
    if (m > 12) {
      m = 1
      y += 1
    }
  }
  return out
}

/**
 * Reconstruye el neto al cierre de cada mes PASADO (estrictamente anterior al
 * mes en curso). Devuelve puntos ascendentes por fecha. No incluye "hoy" (eso
 * lo añade la capa de lectura con el neto vivo).
 */
export function reconstructNetSeries(
  netNow: number,
  todayIso: string,
  monthlyFlows: MonthFlow[],
): NetPoint[] {
  const currentMonth = todayIso.slice(0, 7)
  const flowByMonth = new Map(monthlyFlows.map((f) => [f.month, f.flow]))

  const pastMonths = monthlyFlows.map((f) => f.month).filter((m) => m < currentMonth)
  if (pastMonths.length === 0) return []
  const earliest = pastMonths.reduce((a, b) => (a < b ? a : b))
  const months = monthSequence(earliest, currentMonth) // ascendente, sin el mes actual

  // suffix = Σ flujo de los meses estrictamente posteriores al mes que estamos
  // evaluando. Arranca con el flujo del mes en curso (posterior a todo mes pasado).
  let suffix = flowByMonth.get(currentMonth) ?? 0
  const points: NetPoint[] = []
  for (let i = months.length - 1; i >= 0; i--) {
    const m = months[i]!
    points.push({ date: endOfMonthIso(m), net: round2(netNow - suffix) })
    suffix += flowByMonth.get(m) ?? 0
  }
  points.reverse()
  return points
}
