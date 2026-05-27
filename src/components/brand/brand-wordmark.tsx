import { cn } from '@/lib/utils'

type Props = {
  size?: number
  className?: string
  as?: 'span' | 'div' | 'h1'
}

/**
 * Wordmark "finanzia" — Sora 500, lowercase, tracking -0.05em.
 * Único componente autorizado a usar Sora; el resto de la UI sigue en Inter.
 */
export function BrandWordmark({ size = 16, className, as: Tag = 'span' }: Props) {
  return (
    <Tag
      className={cn('select-none', className)}
      style={{
        fontFamily: 'var(--font-brand), system-ui, -apple-system, sans-serif',
        fontWeight: 500,
        fontSize: `${size}px`,
        letterSpacing: '-0.05em',
        lineHeight: 1,
        textTransform: 'lowercase',
      }}
    >
      finanzia
    </Tag>
  )
}
