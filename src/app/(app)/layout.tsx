import { ViewTransition } from 'react'

import { requireCurrentUser } from '@/lib/auth'
import { Rail } from '@/components/app/rail'
import { Topbar } from '@/components/app/topbar'
import { CommandPalette } from '@/components/app/command-palette'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  await requireCurrentUser()

  return (
    <div className="bg-background text-text min-h-svh">
      <Rail />
      <div className="pl-[56px]">
        <Topbar />
        <main className="mx-auto w-full max-w-[1240px] px-8 py-10">
          <ViewTransition name="app-content">{children}</ViewTransition>
        </main>
      </div>
      <CommandPalette />
    </div>
  )
}
