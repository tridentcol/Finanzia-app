import 'server-only'

import type { CopilotContext } from './context'
import { getBalanceTool } from './tools/get-balance'
import { listRecentTransactionsTool } from './tools/list-recent-transactions'
import { getBudgetStatusTool } from './tools/get-budget-status'
import { listActiveInsightsTool } from './tools/list-active-insights'
import { searchTransactionsTool } from './tools/search-transactions'
import { getDebtsTool } from './tools/get-debts'
import { listRecurringTool } from './tools/list-recurring'
import { getSavingsTool } from './tools/get-savings'
import { listGoalsTool } from './tools/list-goals'
import { getAccountsTool } from './tools/get-accounts'
import { getTopMerchantsTool } from './tools/get-top-merchants'
import { getCashFlowTool } from './tools/get-cash-flow'
import { getAdviceTool } from './tools/get-advice'
import { queryTransactionsTool } from './tools/query-transactions'
import { proposeCreateTransactionTool } from './tools/propose-create-transaction'
import { proposeSetBudgetTool } from './tools/propose-set-budget'
import { proposeCardPurchaseTool } from './tools/propose-card-purchase'

/**
 * Construye el set completo de tools para el copiloto, scopeado al usuario
 * autenticado. Todo se filtra por `ctx.userId` (defensa sobre RLS).
 *
 * Lecturas: cubren cada vista del producto (saldos, cuentas, transacciones,
 * presupuestos, deudas, recurrentes, ahorro, metas, comercios, flujo, insights)
 * con salidas compactas para que el LLM lea TODO sin alucinar cifras.
 *
 * `propose-*`: NO mutan — devuelven una propuesta que la UI confirma con el
 * usuario antes de ejecutar la server action real (regla 6 del mandato).
 */
export function buildCopilotTools(ctx: CopilotContext) {
  return {
    // --- Lecturas de dominio ---
    getBalance: getBalanceTool(ctx),
    getAccounts: getAccountsTool(ctx),
    listRecentTransactions: listRecentTransactionsTool(ctx),
    searchTransactions: searchTransactionsTool(ctx),
    queryTransactions: queryTransactionsTool(ctx),
    getBudgetStatus: getBudgetStatusTool(ctx),
    getDebts: getDebtsTool(ctx),
    listRecurring: listRecurringTool(ctx),
    getSavings: getSavingsTool(ctx),
    listGoals: listGoalsTool(ctx),
    getTopMerchants: getTopMerchantsTool(ctx),
    getCashFlow: getCashFlowTool(ctx),
    listActiveInsights: listActiveInsightsTool(ctx),
    getAdvice: getAdviceTool(ctx),
    // --- Mutaciones (propuesta + confirmación UI) ---
    proposeCreateTransaction: proposeCreateTransactionTool(ctx),
    proposeSetBudget: proposeSetBudgetTool(ctx),
    proposeCardPurchase: proposeCardPurchaseTool(ctx),
  } as const
}

export type CopilotTools = ReturnType<typeof buildCopilotTools>
