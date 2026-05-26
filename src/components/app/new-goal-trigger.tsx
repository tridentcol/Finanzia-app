'use client'

import { Button } from '@/components/ui/button'
import { useDialogStore } from './dialog-store'
import { icons } from '@/lib/design/icons'

export function NewGoalTrigger({ label = 'Nueva meta' }: { label?: string }) {
  const open = useDialogStore((s) => s.open)
  const Plus = icons.plus
  return (
    <Button onClick={() => open('new-goal')} size="sm">
      <Plus strokeWidth={1.5} className="size-3.5" />
      <span className="ml-1.5">{label}</span>
    </Button>
  )
}
