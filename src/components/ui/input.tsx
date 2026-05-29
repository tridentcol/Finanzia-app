import * as React from 'react'

import { cn } from '@/lib/utils'

type InputProps = React.ComponentProps<'input'>

function Input({ className, type = 'text', ...props }: InputProps) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        'bg-bg text-text placeholder:text-text-tertiary border-border-default flex h-11 w-full rounded-[8px] border px-3 text-base sm:h-10 sm:text-sm',
        'transition-colors duration-150 outline-none',
        'focus:border-border-emphasis focus:ring-2 focus:ring-[color:var(--accent-ai)]/30',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'file:border-0 file:bg-transparent file:text-sm file:font-medium',
        className,
      )}
      {...props}
    />
  )
}

export { Input }
export type { InputProps }
