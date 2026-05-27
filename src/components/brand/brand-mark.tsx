import { cn } from '@/lib/utils'

type Props = {
  size?: number
  className?: string
  title?: string
}

/**
 * Símbolo "Horizonte" — dos anillos abiertos + medio disco central.
 * Colores via CSS vars (`--brand-mark-ring`, `--brand-mark-center`) para que
 * se adapten automáticamente a light/dark.
 *
 * El símbolo se centra ópticamente en su viewBox cuadrado: la línea de horizonte
 * cae en y=140 sobre 200, dejando aire arriba y abajo equivalente al área de
 * protección definida por el handoff (≈ radio del disco interior).
 */
export function BrandMark({ size = 24, className, title = 'finanzia' }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      role="img"
      aria-label={title}
      className={cn('shrink-0', className)}
    >
      <path
        d="M 18 140 A 82 82 0 0 1 182 140 L 168 140 A 68 68 0 0 0 32 140 Z"
        fill="var(--brand-mark-ring)"
      />
      <path
        d="M 48 140 A 52 52 0 0 1 152 140 L 138 140 A 38 38 0 0 0 62 140 Z"
        fill="var(--brand-mark-ring)"
      />
      <path
        d="M 78 140 A 22 22 0 0 1 122 140 Z"
        fill="var(--brand-mark-center)"
      />
    </svg>
  )
}
