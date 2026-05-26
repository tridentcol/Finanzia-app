import { ViewTransition } from 'react'

import { requireCurrentUser } from '@/lib/auth'
import { Sidebar } from '@/components/app/sidebar'
import { MobileNav } from '@/components/app/mobile-nav'
import { Topbar } from '@/components/app/topbar'
import { CommandPalette } from '@/components/app/command-palette'
import { NewAccountDialog } from '@/components/app/new-account-dialog'
import { NewTransactionDialog } from '@/components/app/new-transaction-dialog'
import { NewCategoryDialog } from '@/components/app/new-category-dialog'
import { EditCategoryDialog } from '@/components/app/edit-category-dialog'
import { NewBudgetDialog } from '@/components/app/new-budget-dialog'
import { NewGoalDialog } from '@/components/app/new-goal-dialog'
import { NewRecurringDialog } from '@/components/app/new-recurring-dialog'
import { CopilotDialog } from '@/components/app/copilot-dialog'
import {
  listAvailableCategories,
  listUserAccountsBasic,
} from '@/lib/db/queries/transactions'
import { countUnreadAlerts } from '@/lib/db/queries/alerts'

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await requireCurrentUser()

  const [accountsForForm, categoriesForForm, unreadAlerts] = await Promise.all([
    listUserAccountsBasic(user.id),
    listAvailableCategories(user.id),
    countUnreadAlerts(user.id),
  ])

  return (
    <div className="bg-background text-text min-h-svh">
      <Sidebar />
      <div className="lg:pl-[240px]">
        <Topbar unreadAlerts={unreadAlerts} />
        <main className="mx-auto w-full max-w-[1120px] px-4 pt-6 pb-[80px] sm:px-6 lg:px-8 lg:py-10 lg:pb-10">
          <ViewTransition name="app-content">{children}</ViewTransition>
        </main>
      </div>
      <MobileNav />
      <CommandPalette />
      <NewAccountDialog />
      <NewTransactionDialog
        accounts={accountsForForm}
        categories={categoriesForForm}
      />
      <NewCategoryDialog categories={categoriesForForm} />
      <EditCategoryDialog categories={categoriesForForm} />
      <NewBudgetDialog categories={categoriesForForm} />
      <NewGoalDialog accounts={accountsForForm} />
      <NewRecurringDialog
        accounts={accountsForForm}
        categories={categoriesForForm.map((c) => ({ id: c.id, name: c.name, kind: c.kind }))}
      />
      <CopilotDialog />
    </div>
  )
}
