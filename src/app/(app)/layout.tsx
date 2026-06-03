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

  // App-shell nativo en mobile: el wrapper es una COLUMNA del alto de la
  // pantalla (100dvh) que NO scrollea. El topbar y la bottom-nav son items de
  // flex (no fixed, no sticky), y SOLO el contenido (`#main-content`) scrollea
  // entre ellos. Así la nav es físicamente el último elemento de la columna →
  // siempre pegada al borde inferior, sin hueco posible (iOS rompe
  // position:fixed/safe-area de formas impredecibles). Desktop sin cambios:
  // todas las reglas mobile van con `max-md:`.
  return (
    <SidebarProvider
      defaultOpen={sidebarDefault}
      className="max-md:h-[100dvh] max-md:flex-col max-md:overflow-hidden"
    >
      <a
        href="#main-content"
        className="bg-surface text-text border-border-default focus:ring-accent-ai/40 sr-only z-50 rounded-[8px] border px-4 py-2 text-sm shadow-lg outline-none focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:ring-2"
      >
        Ir al contenido
      </a>
      <AppSidebar />
      <SidebarInset className="max-md:min-h-0">
        <Topbar unreadAlerts={unreadAlerts} />
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-8 max-md:min-h-0 max-md:flex-1 max-md:overflow-y-auto max-md:overscroll-y-contain sm:px-6 md:py-10 md:pb-10 lg:px-8"
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
