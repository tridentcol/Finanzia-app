import { getAlertasData } from '@/lib/db/queries/alerts'
import { EmptyState } from '@/components/app/empty-state'
import { AlertList } from '@/components/app/alert-list'

type Props = { userId: string }

export async function AlertasSection({ userId }: Props) {
  const list = await getAlertasData(userId)

  if (list.length === 0) {
    return (
      <EmptyState
        headline="Bandeja vacía."
        body="Cuando Finanzia detecte algo accionable, lo verás aquí. El cron diario empuja anomalías y proyecciones críticas."
      />
    )
  }

  return <AlertList alerts={list} />
}
