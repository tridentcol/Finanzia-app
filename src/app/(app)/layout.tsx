import { Suspense } from 'react'
import { cookies } from 'next/headers'

import { requireCurrentUser } from '@/lib/auth'
import { getProfile } from '@/lib/db/queries/profile'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { AppSidebar } from '@/components/app/app-sidebar'
import { MobileNav } from '@/components/app/mobile-nav'
import { Topbar } from '@/components/app/topbar'
import { CommandPalette } from '@/components/app/command-palette'
import { NewAccountDialog } from '@/components/app/new-account-dialog'
import { NewCardDialog } from '@/components/app/new-card-dialog'
import { ScrollToTop } from '@/components/app/scroll-to-top'
import { NewDebtDialog } from '@/components/app/new-debt-dialog'
import { DialogsBundle } from '@/components/app/dialogs-bundle'
import { OnboardingOverlay } from '@/components/app/onboarding-overlay'
import { StandaloneDetector } from '@/components/app/standalone-detector'
import { PageTransition } from '@/components/app/page-transition'
import { countUnreadAlerts } from '@/lib/db/queries/alerts'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await requireCurrentUser()

  const [unreadAlerts, cookieStore, profile] = await Promise.all([
    countUnreadAlerts(user.id),
    cookies(),
    getProfile(user.id),
  ])
  const sidebarDefault = cookieStore.get('sidebar_state')?.value !== 'false'

  // App-shell: SOLO en PWA instalada (standalone:) el shell es una COLUMNA del
  // alto de pantalla que no scrollea, con topbar/nav como items de flex y el
  // contenido scrolleando en medio → la nav queda pegada al borde inferior.
  // Altura `100lvh` (NO `100dvh`): en iOS standalone black-translucent dvh mide
  // la pantalla MENOS el status bar (medido: 848 vs 896) → dejaba hueco abajo.
  // En NAVEGADOR (base, sin standalone:) se mantiene el scroll del body + nav
  // fija, que convive con la toolbar del browser. Desktop sin cambios (max-md:).
  return (
    <SidebarProvider
      defaultOpen={sidebarDefault}
      className="standalone:max-md:h-[100lvh] standalone:max-md:flex-col standalone:max-md:overflow-hidden"
    >
      <a
        href="#main-content"
        className="bg-surface text-text border-border-default focus:ring-accent-ai/40 sr-only z-50 rounded-[8px] border px-4 py-2 text-sm shadow-lg outline-none focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:ring-2"
      >
        Ir al contenido
      </a>
      <AppSidebar />
      <SidebarInset className="standalone:max-md:min-h-0">
        <Topbar unreadAlerts={unreadAlerts} />
        <main
          id="main-content"
          tabIndex={-1}
          className="standalone:max-md:min-h-0 standalone:max-md:flex-1 standalone:max-md:overflow-y-auto standalone:max-md:overscroll-y-contain standalone:max-md:pb-8 mx-auto w-full max-w-[1120px] px-4 pt-6 pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+24px)] sm:px-6 md:py-10 md:pb-10 lg:px-8"
        >
          <PageTransition>{children}</PageTransition>
        </main>
      </SidebarInset>
      <MobileNav />
      <ScrollToTop />
      <CommandPalette />
      <NewAccountDialog />
      <NewCardDialog />
      <NewDebtDialog />
      <Suspense fallback={null}>
        <DialogsBundle />
      </Suspense>
      <OnboardingOverlay isOnboarded={!!profile?.onboardedAt} />
      <StandaloneDetector />
    </SidebarProvider>
  )
}
