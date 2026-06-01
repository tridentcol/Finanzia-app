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

// `href` apunta al landing REAL de cada sección (no al root que redirige), para
// que `prefetch` precargue el RSC con datos → navegación instantánea. El estado
// activo usa `section` (prefijo que comparten todas las sub-rutas). Un href a
// `/mi-dinero` (redirect 308) solo prefetchearía el redirect, no el dato.
type NavItem = { label: string; href: string; section: string; icon: IconName }

// Top-level items — 4 secciones posesivas. La sub-navegación vive in-page con
// SectionTabs sticky bajo el topbar; no la duplicamos aquí.
const TOP_ITEMS: NavItem[] = [
  { label: 'Hoy', href: '/dashboard', section: '/dashboard', icon: 'home' },
  { label: 'Mi dinero', href: '/mi-dinero/cuentas', section: '/mi-dinero', icon: 'wallet' },
  { label: 'Mi plan', href: '/mi-plan/presupuestos', section: '/mi-plan', icon: 'target' },
  { label: 'Mi historia', href: '/mi-historia/insights', section: '/mi-historia', icon: 'book-open' },
]

const FOOTER_ITEMS: NavItem[] = [
  { label: 'Ajustes', href: '/ajustes', section: '/ajustes', icon: 'settings' },
]

function isActive(pathname: string, section: string): boolean {
  if (section === '/dashboard') return pathname === '/dashboard'
  return pathname === section || pathname.startsWith(`${section}/`)
}

export function AppSidebar() {
  const pathname = usePathname()
  const { isMobile } = useSidebar()
  const Spark = icons.sparkles

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
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {TOP_ITEMS.map((item) => {
                const Icon = icons[item.icon]
                const active = isActive(pathname, item.section)
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

              {/* Copiloto — destino de primer nivel discreto, paridad con el FAB
                  mobile. El sparkles en accent-ai marca presencia de IA (mandato). */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isActive(pathname, '/copilot')}
                  tooltip="Copiloto"
                  className={navItemClass}
                >
                  <Link href="/copilot" prefetch>
                    <Spark strokeWidth={1.5} className="text-[var(--accent-ai)]" />
                    <span>Copiloto</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
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
