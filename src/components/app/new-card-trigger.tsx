'use client'

import { Button } from '@/components/ui/button'
import { icons } from '@/lib/design/icons'
import { useDialogStore } from './dialog-store'

export function NewCardTrigger() {
  const open = useDialogStore((s) => s.open)
  const Plus = icons.plus
  return (
    <Button size="md" onClick={() => open('new-card')}>
      <Plus strokeWidth={1.5} className="size-4" />
      Nueva tarjeta
    </Button>
  )
}
