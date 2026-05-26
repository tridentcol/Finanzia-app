'use client'

import { Button } from '@/components/ui/button'
import { icons } from '@/lib/design/icons'
import { useDialogStore } from './dialog-store'

export function NewBudgetTrigger({
  variant = 'primary',
}: {
  variant?: 'primary' | 'outline'
}) {
  const open = useDialogStore((s) => s.open)
  const Plus = icons.plus
  return (
    <Button variant={variant} onClick={() => open('new-budget')}>
      <Plus strokeWidth={1.5} className="size-4" />
      Nuevo presupuesto
    </Button>
  )
}
