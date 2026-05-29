import type { RecurringDriftSnapshot } from '@/lib/db/queries/recurring'

type Props = {
  snapshot: RecurringDriftSnapshot
}

/**
 * Mini-timeline editorial que muestra, sobre un eje de 1..31 días, el día
 * esperado del cargo (marca central), la ventana de tolerancia (zona sutil)
 * y las últimas N ocurrencias reales (puntos pequeños). Se renderiza al
 * margen de cada regla con dayOfMonth en `/ajustes/recurring` y deja ver de
 * un vistazo si la regla está derivando.
 */
export function RecurringDriftTimeline({ snapshot }: Props) {
  const { expectedDay, toleranceDays, occurrences } = snapshot
  const maxDay = 31

  if (occurrences.length === 0) {
    return (
      <p className="text-text-tertiary text-[11px]">
        Sin transacciones registradas todavía · esperado día {expectedDay} ± {toleranceDays}d
      </p>
    )
  }

  const expectedPct = ((expectedDay - 1) / (maxDay - 1)) * 100
  const tolLeftPct = ((Math.max(1, expectedDay - toleranceDays) - 1) / (maxDay - 1)) * 100
  const tolRightPct =
    ((Math.min(maxDay, expectedDay + toleranceDays) - 1) / (maxDay - 1)) * 100
  const tolWidth = tolRightPct - tolLeftPct

  // Ocurrencia más reciente: la usamos para el color (drift > tolerancia = warning).
  const latest = occurrences[0]
  const latestDrift = latest ? Math.abs(latest.delta) : 0
  const isDrifting = latestDrift > toleranceDays

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
          Últimas {occurrences.length}{' '}
          {occurrences.length === 1 ? 'ocurrencia' : 'ocurrencias'}
        </span>
        <span
          className={`tabular-nums text-[11px] ${
            isDrifting ? 'text-warning' : 'text-text-tertiary'
          }`}
        >
          {latest
            ? `último: día ${latest.actualDay} · ${
                latest.delta === 0
                  ? 'a tiempo'
                  : latest.delta > 0
                    ? `+${latest.delta}d`
                    : `${latest.delta}d`
              }`
            : 'sin datos'}
        </span>
      </div>
      <div className="bg-surface-hover/40 relative h-6 w-full overflow-hidden rounded-full">
        {/* Zona de tolerancia */}
        <div
          className="bg-surface-hover absolute top-0 h-full rounded-full"
          style={{ left: `${tolLeftPct}%`, width: `${tolWidth}%` }}
          aria-hidden
        />
        {/* Línea del día esperado */}
        <div
          className="bg-text-tertiary absolute top-0 h-full w-px"
          style={{ left: `${expectedPct}%` }}
          aria-hidden
        />
        {/* Ocurrencias reales — la más reciente con énfasis */}
        {occurrences.map((occ, i) => {
          const leftPct = ((occ.actualDay - 1) / (maxDay - 1)) * 100
          const isLatest = i === 0
          const inTolerance = Math.abs(occ.delta) <= toleranceDays
          return (
            <span
              key={occ.date}
              className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                isLatest
                  ? `h-2.5 w-2.5 ${inTolerance ? 'bg-text' : 'bg-warning'}`
                  : 'bg-text-tertiary/70 h-1.5 w-1.5'
              }`}
              style={{ left: `${leftPct}%` }}
              title={`${occ.date} · día ${occ.actualDay} (${occ.delta === 0 ? 'a tiempo' : occ.delta > 0 ? `+${occ.delta}d` : `${occ.delta}d`})`}
              aria-hidden
            />
          )
        })}
      </div>
      <div className="text-text-tertiary flex justify-between text-[10px] tabular-nums">
        <span>1</span>
        <span>esperado: día {expectedDay}</span>
        <span>31</span>
      </div>
    </div>
  )
}
