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

  // En mobile el shell mide 100dvh y NO scrollea el body: scrollea el
  // contenedor interno (`#app-scroll`). Así la bottom-nav `fixed` queda anclada
  // al viewport estable y no se despega en iOS standalone (el body scroll es lo
  // que rompe `position: fixed` en iOS). Desktop sin cambios.
  return (
    <SidebarProvider
      defaultOpen={sidebarDefault}
      className="max-md:h-[100dvh] max-md:overflow-hidden"
    >
      <a
        href="#main-content"
        className="bg-surface text-text border-border-default focus:ring-accent-ai/40 sr-only z-50 rounded-[8px] border px-4 py-2 text-sm shadow-lg outline-none focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:ring-2"
      >
        Ir al contenido
      </a>
      <AppSidebar />
      <SidebarInset
        id="app-scroll"
        className="max-md:min-h-0 max-md:overflow-y-auto max-md:overscroll-y-contain"
      >
        <Topbar unreadAlerts={unreadAlerts} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-[calc(var(--mobile-nav-h)+env(safe-area-inset-bottom)+24px)] sm:px-6 md:pb-10 lg:px-8 lg:py-10"
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
