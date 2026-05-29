'use client'

import { Tooltip as TooltipPrimitive } from 'radix-ui'

import { icons } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

type Props = {
  label: string
  /** Posición relativa al trigger. */
  side?: 'top' | 'right' | 'bottom' | 'left'
  /** Tamaño del icono. Default 12px. */
  size?: 12 | 14
  className?: string
}

/**
 * Icono "?" minimalista con tooltip Noir. Usado para explicar conceptos
 * cuya jerga (Runway, ±1σ, Patrimonio neto) puede no ser obvia.
 *
 * El icono debe quedar al lado del label, no dentro del valor — los
 * números son los héroes; el hint los acompaña sin opacarlos.
 */
export function InfoHint({ label, side = 'top', size = 12, className }: Props) {
  const HelpCircle = icons['help-circle']
  return (
    <TooltipPrimitive.Root delayDuration={120}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'text-text-tertiary hover:text-text-secondary inline-flex shrink-0 items-center transition-colors',
            'focus-visible:ring-accent-ai/40 focus-visible:rounded-full focus-visible:ring-2 focus-visible:outline-none',
            className,
          )}
        >
          <HelpCircle
            strokeWidth={1.5}
            className={size === 14 ? 'size-[14px]' : 'size-[12px]'}
          />
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={side}
          sideOffset={6}
          className={cn(
            'z-50 max-w-[260px] rounded-[8px] border px-3 py-2 text-[12px] leading-relaxed shadow-xl outline-none',
            'border-[var(--border-default)] bg-[var(--surface-elevated)] text-[var(--text-secondary)]',
            'data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95',
            'data-[state=closed]:animate-out data-[state=closed]:fade-out-0',
          )}
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  )
}
