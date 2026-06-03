import { Amount } from '@/components/app/amount'
import type { CurrencyCode } from '@/lib/currency/currencies'

export type UpcomingEvent = {
  date: string
  description: string
  amount: number
  kind: 'income' | 'expense'
}

function isoWeekStart(dateIso: string): string {
  const d = new Date(`${dateIso}T12:00:00Z`)
  const day = d.getUTCDay()
  const offset = day === 0 ? -6 : 1 - day
  d.setUTCDate(d.getUTCDate() + offset)
  return d.toISOString().slice(0, 10)
}

function formatWeekLabel(weekStartIso: string): string {
  const start = new Date(`${weekStartIso}T12:00:00Z`)
  const end = new Date(start)
  end.setUTCDate(end.getUTCDate() + 6)
  const fmt = (d: Date) =>
    d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', timeZone: 'UTC' })
  return `${fmt(start)} – ${fmt(end)}`
}

function eventDateLabel(dateIso: string): string {
  return new Date(dateIso + 'T12:00:00Z').toLocaleDateString('es-CO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

/** Lista de próximos eventos del flujo. Agrupa por semana si hay más de 6. */
export function UpcomingEvents({
  events,
  currency,
}: {
  events: UpcomingEvent[]
  currency: CurrencyCode
}) {
  const groupByWeek = events.length > 6

  if (!groupByWeek) {
    return (
      <section className="flex flex-col gap-4">
        <header className="flex items-baseline justify-between">
          <h2 className="text-text text-sm font-semibold">Próximos eventos</h2>
          <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
            Siguientes 14 días
          </span>
        </header>
        <ul className="border-border-default bg-surface flex flex-col rounded-[12px] border">
          {events.map((e, i) => (
            <li
              key={`${e.date}-${i}`}
              className={`flex items-center justify-between gap-4 px-5 py-3 ${
                i !== events.length - 1 ? 'border-border-default/60 border-b' : ''
              }`}
            >
              <div className="flex min-w-0 flex-col">
                <span className="text-text truncate text-sm">{e.description}</span>
                <span className="text-text-tertiary text-[11px]">{eventDateLabel(e.date)}</span>
              </div>
              <Amount
                value={String(e.amount)}
                currency={currency}
                kind={e.kind === 'income' ? 'positive' : 'negative'}
                showPositiveSign={e.kind === 'income'}
                className="shrink-0 text-sm"
              />
            </li>
          ))}
        </ul>
      </section>
    )
  }

  const weeks = new Map<string, UpcomingEvent[]>()
  for (const e of events) {
    const key = isoWeekStart(e.date)
    const arr = weeks.get(key) ?? []
    arr.push(e)
    weeks.set(key, arr)
  }
  const weekEntries = Array.from(weeks.entries()).sort(([a], [b]) => a.localeCompare(b))

  return (
    <section className="flex flex-col gap-4">
      <header className="flex items-baseline justify-between">
        <h2 className="text-text text-sm font-semibold">Próximos eventos</h2>
        <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
          Agrupados por semana
        </span>
      </header>
      <div className="border-border-default bg-surface flex flex-col rounded-[12px] border">
        {weekEntries.map(([weekStart, weekEvents], wi) => {
          const weekNet = weekEvents.reduce(
            (acc, e) => acc + (e.kind === 'income' ? e.amount : -e.amount),
            0,
          )
          return (
            <div
              key={weekStart}
              className={wi !== weekEntries.length - 1 ? 'border-border-default/60 border-b' : ''}
            >
              <div className="bg-surface-hover/40 flex items-baseline justify-between gap-3 px-5 py-2">
                <span className="text-text-tertiary text-[11px] tracking-[0.08em] uppercase">
                  {formatWeekLabel(weekStart)}
                </span>
                <span
                  className={`tabular text-[12px] ${weekNet >= 0 ? 'text-positive' : 'text-negative'}`}
                >
                  {weekNet >= 0 ? '+' : ''}
                  {Math.round(weekNet).toLocaleString('es-CO')}
                </span>
              </div>
              <ul>
                {weekEvents.map((e, i) => (
                  <li
                    key={`${e.date}-${i}`}
                    className="flex items-center justify-between gap-4 px-5 py-2.5"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="text-text truncate text-sm">{e.description}</span>
                      <span className="text-text-tertiary text-[11px]">
                        {eventDateLabel(e.date)}
                      </span>
                    </div>
                    <Amount
                      value={String(e.amount)}
                      currency={currency}
                      kind={e.kind === 'income' ? 'positive' : 'negative'}
                      showPositiveSign={e.kind === 'income'}
                      className="shrink-0 text-sm"
                    />
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
