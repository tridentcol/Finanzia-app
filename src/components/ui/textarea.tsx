import * as React from 'react'

import { cn } from '@/lib/utils'

type TextareaProps = React.ComponentProps<'textarea'>

function Textarea({ className, rows = 3, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      data-slot="textarea"
      className={cn(
        'bg-bg text-text placeholder:text-text-tertiary border-border-default flex w-full rounded-[8px] border px-3 py-2 text-base leading-relaxed resize-none sm:text-sm',
        'transition-colors duration-150 outline-none',
        'focus:border-border-emphasis focus:ring-2 focus:ring-[color:var(--accent-ai)]/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
export type { TextareaProps }
