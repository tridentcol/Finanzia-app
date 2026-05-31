'use client'

import { useEffect, useRef, useState } from 'react'

import { icons } from '@/lib/design/icons'
import { useIsMobile } from '@/hooks/use-mobile'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import {
  CopilotToneCard,
  type ToneCardProps,
} from '@/app/(app)/ajustes/perfil-financiero/copilot-tone-card'
import { markCopilotToneIntroSeen } from '@/app/(app)/copilot/actions'

/**
 * Acceso al tono del copiloto desde el header: un botón de parámetros (sliders)
 * que abre un sheet con la `CopilotToneCard`. El sheet se auto-abre solo la
 * primera vez que se entra a /copilot (flag `aiProfile.copilot.toneIntroSeen`,
 * server, cross-device). El sheet no tiene inputs de texto, así que no abre el
 * teclado mobile.
 *
 * Lateral en desktop, inferior en mobile (los grupos de chips respiran mejor).
 */
export function CopilotToneSheet({
  toneProps,
  introSeen,
}: {
  toneProps: ToneCardProps
  introSeen: boolean
}) {
  const isMobile = useIsMobile()
  // Auto-abre la primera vez (init perezoso, sin setState en effect).
  const [open, setOpen] = useState(() => !introSeen)
  const Sliders = icons.sliders

  // Marca "visto" apenas se auto-abre —no al cerrar— para que persista aunque el
  // usuario navegue sin cerrar el sheet. Solo dispara la server action (sin
  // setState), válido dentro del effect. revalidatePath busta el router cache.
  const markedRef = useRef(introSeen)
  useEffect(() => {
    if (markedRef.current) return
    markedRef.current = true
    markCopilotToneIntroSeen().catch(() => {
      markedRef.current = false
    })
  }, [])

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="Ajustar cómo te habla"
          title="Cómo te habla el copiloto"
          className="text-text-tertiary hover:text-text flex size-11 shrink-0 items-center justify-center rounded-[8px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-ai)]/40"
        >
          <Sliders
            strokeWidth={1.5}
            className="size-4"
            style={{ color: 'var(--accent-ai)' }}
          />
        </button>
      </SheetTrigger>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className="gap-0 overflow-y-auto data-[side=bottom]:max-h-[85dvh] data-[side=right]:sm:max-w-md"
      >
        <SheetHeader>
          <SheetTitle>Cómo te habla el copiloto</SheetTitle>
          <SheetDescription>
            Ajusta el tono y la profundidad de las respuestas a tu forma de leer.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-6">
          <CopilotToneCard {...toneProps} variant="sheet" onSaved={() => setOpen(false)} />
        </div>
      </SheetContent>
    </Sheet>
  )
}
