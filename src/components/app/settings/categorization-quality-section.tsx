import { getCategorizationQualityCached } from '@/lib/db/queries/ai-quality'

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

/**
 * Calidad de la categorización IA medida con datos reales: cuántas sugerencias
 * aceptaste vs corregiste. Es la señal para afinar los umbrales del motor.
 */
export async function CategorizationQualitySection({ userId }: { userId: string }) {
  const q = await getCategorizationQualityCached(userId)

  if (q.aiTotal === 0) {
    return (
      <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
        Aún no hay transacciones categorizadas por IA. Cuando importes o registres
        movimientos, acá vas a ver qué tan seguido las sugerencias dan en el blanco.
      </p>
    )
  }

  const accepted = q.aiTotal - q.corrected
  const acceptRate = 1 - q.correctionRate
  // Sobreconfianza: corrige seguido pero con confianza alta en las corregidas.
  const overconfident =
    q.correctionRate >= 0.2 &&
    q.avgConfidenceCorrected != null &&
    q.avgConfidenceCorrected >= 0.7

  const stats: Array<{ label: string; value: string; hint?: string }> = [
    { label: 'Aceptadas sin corregir', value: pct(acceptRate), hint: `${accepted} de ${q.aiTotal}` },
    { label: 'Corregidas por vos', value: pct(q.correctionRate), hint: `${q.corrected} de ${q.aiTotal}` },
    {
      label: 'Confianza promedio',
      value: q.avgConfidence != null ? pct(q.avgConfidence) : '—',
    },
  ]

  return (
    <div className="flex flex-col gap-5">
      <p className="text-text-secondary max-w-prose text-sm leading-relaxed">
        Qué tan seguido aceptás las categorías que sugiere Finanzia. Una tasa de
        corrección alta es la señal para afinar el motor.
      </p>

      <dl className="grid grid-cols-1 gap-px overflow-hidden rounded-[12px] border border-border-default bg-border-default sm:grid-cols-3">
        {stats.map((s) => (
          <div key={s.label} className="bg-surface flex flex-col gap-1 p-5">
            <dt className="text-text-tertiary text-[11px] uppercase tracking-[0.08em]">
              {s.label}
            </dt>
            <dd className="text-text tabular text-2xl">{s.value}</dd>
            {s.hint && <span className="text-text-tertiary tabular text-[11px]">{s.hint}</span>}
          </div>
        ))}
      </dl>

      {overconfident && (
        <p className="text-text-tertiary max-w-prose text-[12px] leading-relaxed">
          El motor viene sugiriendo con confianza alta categorías que después
          corregís — está sobreconfiado. Vale subir el umbral de aceptación para
          que pregunte más seguido en vez de asumir.
        </p>
      )}
    </div>
  )
}
