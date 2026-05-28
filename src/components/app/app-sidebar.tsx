'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar'
import { icons, type IconName } from '@/lib/design/icons'
import { BrandMark } from '@/components/brand/brand-mark'
import { BrandWordmark } from '@/components/brand/brand-wordmark'

// Hover y active del sidebar tintados con el morado de marca — detalle sutil.
// Override del hover/active default del shadcn (que es bg-sidebar-accent neutro).
const navItemClass =
  'hover:!bg-[var(--nav-hover-bg)] data-[active=true]:!bg-[var(--nav-active-bg)] data-[active=true]:!text-[var(--nav-active-fg)] data-[active=true]:!font-medium'

type NavItem = { label: string; href: string; icon: IconName }
type NavSection = { id: string; label: string; items: NavItem[] }

const SECTIONS: NavSection[] = [
  {
    id: 'overview',
    label: 'Visión general',
    items: [{ label: 'Resumen', href: '/dashboard', icon: 'home' }],
  },
  {
    id: 'operation',
    label: 'Operación',
    items: [
      { label: 'Cuentas', href: '/cuentas', icon: 'wallet' },
      { label: 'Transacciones', href: '/transacciones', icon: 'list' },
      { label: 'Deudas', href: '/deudas', icon: 'landmark' },
      { label: 'Importar', href: '/importar', icon: 'upload' },
      { label: 'Categorías', href: '/categorias', icon: 'tag' },
      { label: 'Presupuestos', href: '/presupuestos', icon: 'target' },
      { label: 'Metas', href: '/metas', icon: 'piggy-bank' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Inteligencia',
    items: [
      { label: 'Ahorro', href: '/ahorro', icon: 'trending-up' },
      { label: 'Cash Flow', href: '/cash-flow', icon: 'trending-down' },
      { label: 'Insights', href: '/insights', icon: 'sparkles' },
      { label: 'Informes', href: '/informes', icon: 'book-open' },
    ],
  },
]

const FOOTER_ITEMS: NavItem[] = [
  { label: 'Ajustes', href: '/ajustes', icon: 'settings' },
]

function isActive(pathname: string, href: string): boolean {
  if (href === '/dashboard') return pathname === '/dashboard'
  return pathname === href || pathname.startsWith(`${href}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { isMobile } = useSidebar()

  // En mobile usamos MobileNav (bottom-nav fijo + sheet "Más").
  // El sidebar es exclusivo de >=md.
  if (isMobile) return null

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          aria-label="finanzia"
          className="flex h-10 items-center gap-2 px-2 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:self-center group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0"
        >
          <BrandMark size={24} />
          <BrandWordmark
            size={18}
            className="text-text truncate group-data-[collapsible=icon]:hidden"
          />
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {SECTIONS.map((section) => (
          <SidebarGroup key={section.id}>
            <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const Icon = icons[item.icon]
                  const active = isActive(pathname, item.href)
                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={navItemClass}
                      >
                        <Link href={item.href} prefetch>
                          <Icon strokeWidth={1.5} />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          {FOOTER_ITEMS.map((item) => {
            const Icon = icons[item.icon]
            const active = isActive(pathname, item.href)
            return (
              <SidebarMenuItem key={item.href}>
                <SidebarMenuButton
                  asChild
                  isActive={active}
                  tooltip={item.label}
                  className={navItemClass}
                >
                  <Link href={item.href} prefetch>
                    <Icon strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
          <SidebarMenuItem>
            <div className="flex items-center gap-2 px-2 py-1.5">
              <UserButton
                appearance={{ elements: { avatarBox: 'size-7' } }}
              />
              <span className="text-text-secondary truncate text-[12px] group-data-[collapsible=icon]:hidden">
                Tu cuenta
              </span>
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
