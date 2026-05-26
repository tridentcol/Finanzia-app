/**
 * Empty state editorial — regla 14 del mandato.
 * Tipografía Fraunces italic en el headline, Inter en el body, sin ilustración.
 */

type EmptyStateProps = {
  headline: string
  body: string
  action?: React.ReactNode
}

export function EmptyState({ headline, body, action }: EmptyStateProps) {
  return (
    <section className="border-border-default bg-surface flex flex-col items-start gap-5 rounded-[12px] border p-10">
      <p className="editorial text-text text-2xl leading-tight">{headline}</p>
      <p className="text-text-secondary max-w-md text-sm leading-relaxed">
        {body}
      </p>
      {action ? <div className="pt-2">{action}</div> : null}
    </section>
  )
}
