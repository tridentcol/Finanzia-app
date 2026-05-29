import 'server-only'

import type { CopilotContext } from './context'
import { getBalanceTool } from './tools/get-balance'
import { listRecentTransactionsTool } from './tools/list-recent-transactions'
import { getBudgetStatusTool } from './tools/get-budget-status'
import { listActiveInsightsTool } from './tools/list-active-insights'
import { searchTransactionsTool } from './tools/search-transactions'
import { proposeCreateTransactionTool } from './tools/propose-create-transaction'
import { proposeSetBudgetTool } from './tools/propose-set-budget'
import { proposeCardPurchaseTool } from './tools/propose-card-purchase'

/**
 * Construye el set completo de tools para el copiloto, scopeado al usuario
 * autenticado. Los tools `propose-*` no mutan — devuelven una propuesta que
 * la UI confirma con el usuario antes de ejecutar la server action real
 * (regla 6 del mandato).
 */
export function buildCopilotTools(ctx: CopilotContext) {
  return {
    getBalance: getBalanceTool(ctx),
    listRecentTransactions: listRecentTransactionsTool(ctx),
    getBudgetStatus: getBudgetStatusTool(ctx),
    listActiveInsights: listActiveInsightsTool(ctx),
    searchTransactions: searchTransactionsTool(ctx),
    proposeCreateTransaction: proposeCreateTransactionTool(ctx),
    proposeSetBudget: proposeSetBudgetTool(ctx),
    proposeCardPurchase: proposeCardPurchaseTool(ctx),
  } as const
}

export type CopilotTools = ReturnType<typeof buildCopilotTools>
