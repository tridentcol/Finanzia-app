'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

type LinkItem = {
  label: string
  href: string
  icon: IconName
}

// Config + datos que ya no viven en el bottom-nav. Importar sigue aquí porque su
// hogar contextual (CTA en movimientos) aún no existe; quitarlo de todo menú
// sería una regresión de descubrimiento.
const ITEMS: LinkItem[] = [
  { label: 'Ajustes', href: '/ajustes', icon: 'settings' },
  { label: 'Categorías', href: '/ajustes#categorias', icon: 'tag' },
  { label: 'Integraciones IA', href: '/ajustes#integraciones-ia', icon: 'sparkles' },
  { label: 'Importar CSV', href: '/mi-dinero/movimientos?import=open', icon: 'upload' },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Menú de cuenta y configuración en mobile (<md): un Sheet bottom bajo el avatar
 * del topbar. Reemplaza al antiguo "Más" del bottom-nav — la navegación de
 * contenido vive ahora en el bottom-nav (4 secciones + copiloto); este sheet
 * sólo expone config + sesión. Cubre la safe-area inferior vía el propio Sheet.
 */
export function MobileAccountSheet({ open, onOpenChange }: Props) {
  const pathname = usePathname()
  const router = useRouter()
  const prevPath = useRef(pathname)

  // Cierra al cambiar de ruta (cuando se toca un Link o el botón atrás). Sólo
  // actúa en un cambio REAL de pathname — incluir `open` en deps cerraría el
  // sheet en el mismo momento de abrirlo.
  useEffect(() => {
    if (prevPath.current !== pathname) {
      prevPath.current = pathname
      onOpenChange(false)
    }
  }, [pathname, onOpenChange])

  // Calienta las rutas al abrir: el <Link prefetch> no las ve mientras el Sheet
  // está cerrado.
  useEffect(() => {
    if (!open) return
    for (const item of ITEMS) router.prefetch(item.href)
  }, [open, router])

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="md:hidden">
        <SheetHeader>
          <SheetTitle>Tu cuenta</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-1 px-2 pb-2">
          {ITEMS.map((item) => {
            const Icon = icons[item.icon]
            const active =
              pathname === item.href || pathname.startsWith(`${item.href.split('#')[0]}/`)
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onTouchStart={() => router.prefetch(item.href)}
                onClick={() => onOpenChange(false)}
                aria-label={item.label}
                className={cn(
                  'flex min-h-[44px] items-center gap-3 rounded-[8px] px-2.5 text-[14px] transition-colors',
                  active ? 'bg-surface-hover text-text' : 'text-text-secondary hover:bg-surface-hover/60',
                )}
              >
                <Icon
                  strokeWidth={1.5}
                  className={cn('size-[18px] shrink-0', active ? 'text-text' : 'text-text-tertiary')}
                />
                <span className="flex-1 truncate">{item.label}</span>
              </Link>
            )
          })}

          <div className="border-border-default mt-3 flex items-center gap-3 border-t px-1 pt-4">
            <UserButton appearance={{ elements: { avatarBox: 'size-9' } }} />
            <div className="flex min-w-0 flex-col">
              <span className="text-text text-[13px] font-medium">Sesión</span>
              <span className="text-text-tertiary truncate text-[12px]">Gestiona tu cuenta</span>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
