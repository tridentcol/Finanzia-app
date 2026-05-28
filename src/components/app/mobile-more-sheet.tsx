'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { icons, type IconName } from '@/lib/design/icons'
import { cn } from '@/lib/utils'

type LinkItem = {
  label: string
  href: string
  icon: IconName
}

type Section = {
  label: string
  items: LinkItem[]
}

const SECTIONS: Section[] = [
  {
    label: 'Operación',
    items: [
      { label: 'Deudas', href: '/deudas', icon: 'landmark' },
      { label: 'Importar', href: '/importar', icon: 'upload' },
      { label: 'Categorías', href: '/categorias', icon: 'tag' },
      { label: 'Presupuestos', href: '/presupuestos', icon: 'target' },
      { label: 'Metas', href: '/metas', icon: 'piggy-bank' },
      { label: 'Ahorro', href: '/ahorro', icon: 'trending-up' },
      { label: 'Cash Flow', href: '/cash-flow', icon: 'trending-down' },
      { label: 'Informes', href: '/informes', icon: 'book-open' },
    ],
  },
  {
    label: 'Configuración',
    items: [
      { label: 'Ajustes', href: '/ajustes', icon: 'settings' },
      { label: 'Integraciones IA', href: '/ajustes/integraciones', icon: 'sparkles' },
      { label: 'Reglas recurrentes', href: '/ajustes/recurring', icon: 'repeat' },
      { label: 'Alertas', href: '/ajustes/alertas', icon: 'bell' },
    ],
  },
]

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Sheet full-screen mobile que expone secciones no presentes en el bottom-nav
 * (importar, categorías, presupuestos, metas, ajustes y sub-páginas). Se
 * dispara desde el item "Más" del MobileNav.
 */
export function MobileMoreSheet({ open, onOpenChange }: Props) {
  const pathname = usePathname()
  const router = useRouter()

  // Cierra el sheet automáticamente cuando cambia la ruta (al tocar un Link).
  useEffect(() => {
    if (open) onOpenChange(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Cuando se abre el sheet, calienta las rutas listadas — el IntersectionObserver
  // del <Link prefetch> no las ve hasta que el Dialog las monta visibles, así
  // que un loop directo de prefetch en el momento del open garantiza que para
  // cuando el usuario toque un item, el RSC ya esté en cache.
  useEffect(() => {
    if (!open) return
    for (const section of SECTIONS) {
      for (const item of section.items) {
        router.prefetch(item.href)
      }
    }
  }, [open, router])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:hidden">
        <DialogHeader>
          <DialogTitle>Más</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-6">
          {SECTIONS.map((section) => (
            <div key={section.label} className="flex flex-col gap-2">
              <span className="text-text-tertiary px-1 text-[10px] font-medium uppercase tracking-[0.1em]">
                {section.label}
              </span>
              <div className="flex flex-col">
                {section.items.map((item) => {
                  const Icon = icons[item.icon]
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      prefetch
                      onTouchStart={() => router.prefetch(item.href)}
                      onClick={() => onOpenChange(false)}
                      aria-label={item.label}
                      className={cn(
                        'flex min-h-[44px] items-center gap-3 rounded-[8px] px-2.5 py-2 text-[14px] transition-colors',
                        active
                          ? 'bg-surface-hover text-text'
                          : 'text-text-secondary hover:bg-surface-hover/60',
                      )}
                    >
                      <Icon
                        strokeWidth={1.5}
                        className={cn(
                          'size-[18px] shrink-0',
                          active ? 'text-text' : 'text-text-tertiary',
                        )}
                      />
                      <span className="flex-1 truncate">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}

          <div className="border-border-default mt-2 flex items-center gap-3 border-t pt-4">
            <UserButton
              appearance={{ elements: { avatarBox: 'size-9' } }}
            />
            <div className="flex min-w-0 flex-col">
              <span className="text-text text-[13px] font-medium">Tu cuenta</span>
              <span className="text-text-tertiary truncate text-[12px]">
                Gestiona tu sesión
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
