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
} from '@/components/ui/sidebar'
import { icons, type IconName } from '@/lib/design/icons'

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
      { label: 'Importar', href: '/importar', icon: 'upload' },
      { label: 'Categorías', href: '/categorias', icon: 'tag' },
      { label: 'Presupuestos', href: '/presupuestos', icon: 'target' },
      { label: 'Metas', href: '/metas', icon: 'piggy-bank' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Inteligencia',
    items: [{ label: 'Insights', href: '/insights', icon: 'sparkles' }],
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <Link
          href="/dashboard"
          aria-label="Finanzia"
          className="flex h-10 items-center gap-2 px-2"
        >
          <span
            aria-hidden
            className="grid size-6 shrink-0 place-items-center rounded-[6px]"
            style={{ background: 'var(--accent-ai)' }}
          >
            <span className="text-[13px] font-semibold text-black">F</span>
          </span>
          <span className="text-text truncate text-[14px] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            Finanzia
          </span>
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
