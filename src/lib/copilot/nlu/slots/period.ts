import type { Granularity, PeriodSlot } from '../../intents/types'
import { normalize } from '../normalize'

/**
 * Extractor de período temporal ES. Puro: recibe la utterance y el "hoy" ISO
 * y devuelve un PeriodSlot, o null si no hay ninguna pista temporal (el caller
 * decide el default — típicamente el mes en curso).
 *
 * Reconoce ~25 patrones: día (hoy/ayer/anteayer), semana, mes, año, trimestre,
 * mes nombrado ("en marzo", "marzo 2026"), últimos N días, y rangos simples.
 * Toda la aritmética es en UTC para evitar corrimientos por timezone.
 */

const MONTHS: Record<string, number> = {
  enero: 0, febrero: 1, marzo: 2, abril: 3, mayo: 4, junio: 5,
  julio: 6, agosto: 7, septiembre: 8, setiembre: 8, octubre: 9,
  noviembre: 10, diciembre: 11,
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function dayOf(todayIso: string): Date {
  return new Date(`${todayIso}T00:00:00Z`)
}

function single(d: Date, label: string): PeriodSlot {
  return { from: iso(d), to: iso(d), label, granularity: 'day' }
}

function monthRange(year: number, month: number, label: string): PeriodSlot {
  const start = new Date(Date.UTC(year, month, 1))
  const end = new Date(Date.UTC(year, month + 1, 0))
  return { from: iso(start), to: iso(end), label, granularity: 'month' }
}

function lastDays(todayIso: string, days: number): PeriodSlot {
  const end = dayOf(todayIso)
  const start = new Date(end)
  start.setUTCDate(start.getUTCDate() - (days - 1))
  return {
    from: iso(start),
    to: iso(end),
    label: `los últimos ${days} días`,
    granularity: 'day',
  }
}

function quarter(year: number, q: number): PeriodSlot {
  const startMonth = (q - 1) * 3
  const start = new Date(Date.UTC(year, startMonth, 1))
  const end = new Date(Date.UTC(year, startMonth + 3, 0))
  return {
    from: iso(start),
    to: iso(end),
    label: `Q${q} ${year}`,
    granularity: 'quarter',
  }
}

export function extractPeriod(input: string, todayIso: string): PeriodSlot | null {
  const n = normalize(input)
  const today = dayOf(todayIso)
  const year = today.getUTCFullYear()

  // ---- Día ----
  if (/\banteayer\b/.test(n) || /\bantier\b/.test(n)) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - 2)
    return single(d, 'anteayer')
  }
  if (/\bayer\b/.test(n)) {
    const d = new Date(today)
    d.setUTCDate(d.getUTCDate() - 1)
    return single(d, 'ayer')
  }
  if (/\bhoy\b/.test(n)) return single(today, 'hoy')

  // ---- Semana ----
  if (/\b(semana pasada|ultima semana|semana anterior)\b/.test(n)) {
    return lastDays(todayIso, 7) // aproximación rolling de 7 días
  }
  if (/\b(esta semana|semana en curso)\b/.test(n)) {
    // Lunes de la semana actual (ISO).
    const dow = (today.getUTCDay() + 6) % 7 // 0 = lunes
    const start = new Date(today)
    start.setUTCDate(start.getUTCDate() - dow)
    return {
      from: iso(start),
      to: iso(today),
      label: 'esta semana',
      granularity: 'week',
    }
  }
  if (/\b(ultimos? 7 dias|siete dias|7 dias)\b/.test(n)) return lastDays(todayIso, 7)

  // ---- Mes ----
  if (/\b(mes pasado|ultimo mes|mes anterior)\b/.test(n)) {
    const m = today.getUTCMonth() - 1
    const y = m < 0 ? year - 1 : year
    return monthRange(y, (m + 12) % 12, 'el mes pasado')
  }
  if (/\b(ultimos? 30 dias|treinta dias|30 dias)\b/.test(n)) return lastDays(todayIso, 30)

  // ---- Año ----
  if (/\b(ano pasado|ultimo ano|year pasado)\b/.test(n)) {
    return {
      from: `${year - 1}-01-01`,
      to: `${year - 1}-12-31`,
      label: `${year - 1}`,
      granularity: 'year',
    }
  }
  if (/\b(este ano|ano en curso|en lo que va de el ano)\b/.test(n)) {
    return {
      from: `${year}-01-01`,
      to: iso(today),
      label: `${year}`,
      granularity: 'year',
    }
  }
  if (/\b(ultimos? 12 meses|doce meses)\b/.test(n)) return lastDays(todayIso, 365)

  // ---- Trimestre ----
  const qMatch = n.match(/\bq([1-4])\b/)
  if (qMatch) return quarter(year, Number.parseInt(qMatch[1] as string, 10))
  const ordQ = n.match(/\b(primer|segundo|tercer|cuarto) trimestre\b/)
  if (ordQ) {
    const map: Record<string, number> = { primer: 1, segundo: 2, tercer: 3, cuarto: 4 }
    return quarter(year, map[ordQ[1] as string] as number)
  }

  // ---- Mes nombrado: "en marzo", "marzo 2026", "marzo de el ano pasado" ----
  for (const [name, idx] of Object.entries(MONTHS)) {
    const re = new RegExp(`\\b${name}\\b`)
    if (re.test(n)) {
      const yMatch = n.match(/\b(20\d{2})\b/)
      let y = year
      if (yMatch) y = Number.parseInt(yMatch[1] as string, 10)
      else if (/de el ano pasado/.test(n)) y = year - 1
      const label = yMatch || /ano pasado/.test(n) ? `${name} ${y}` : name
      return monthRange(y, idx, label)
    }
  }

  return null
}
