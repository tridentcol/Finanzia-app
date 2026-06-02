import 'server-only'
import { tool } from 'ai'
import { z } from 'zod'

import { listAccountsWithBalance } from '@/lib/db/queries/accounts'
import { getAccountById } from '@/lib/db/queries/account-detail'
import { analyzePurchase } from '@/lib/cards/purchase-analysis'
import type { CopilotContext } from '../context'

/**
 * Analiza el costo real de una compra a cuotas con tarjeta de crédito,
 * sin mutar nada. Devuelve días al corte, total con intereses, cuota
 * mensual, utilización resultante y highlights humanos. Lo que la UI
 * rendea aparte como widget `PurchaseAnalyzer`, este tool lo hace
 * disponible en el chat — útil para "¿cuánto me cuesta de verdad esta TV
 * a 12 meses con mi Falabella?".
 *
 * Sin mutaciones, pero sigue el naming `propose*` por consistencia con el
 * patrón: el copiloto no decide por el usuario, sólo analiza.
 */
export function proposeCardPurchaseTool(ctx: CopilotContext) {
  return tool({
    description:
      'Analiza el costo real de una compra a cuotas con una tarjeta de crédito específica. Devuelve días al próximo corte, total con intereses, cuota mensual, utilización resultante y recomendaciones. No ejecuta nada. Usa cuando el usuario pregunte "¿me conviene comprar X a Y cuotas con mi tarjeta Z?", "cuánto me cuesta de verdad", "qué pasa si compro a cuotas".',
    inputSchema: z.object({
      accountName: z
        .string()
        .describe(
          'Nombre EXACTO de la tarjeta de crédito (tal como aparece en accounts).',
        ),
      amount: z
        .number()
        .positive()
        .describe('Monto de la compra en la moneda de la tarjeta.'),
      installments: z
        .number()
        .int()
        .min(1)
        .max(60)
        .describe('Número de cuotas. 1 = pago contado en el siguiente corte.'),
    }),
    execute: async (input) => {
      // Resolución por nombre — busca primero en la lista del usuario para
      // tener saldo computado y filtros consistentes.
      const allAccounts = await listAccountsWithBalance(ctx.userId)
      const accountSummary = allAccounts.find(
        (a) => a.name === input.accountName && !a.archived,
      )

      if (!accountSummary) {
        return {
          ok: false as const,
          error: `No encontré una tarjeta llamada "${input.accountName}". Pídele al usuario que confirme el nombre exacto.`,
        }
      }

      if (accountSummary.type !== 'credit_card') {
        return {
          ok: false as const,
          error: `"${accountSummary.name}" no es una tarjeta de crédito sino tipo ${accountSummary.type}. El analizador sólo aplica a credit_card.`,
        }
      }

      // Detalle completo (incluye creditCardProfile via LEFT JOIN).
      const detail = await getAccountById(ctx.userId, accountSummary.id)
      if (!detail) {
        return {
          ok: false as const,
          error: 'No pude cargar el detalle de la tarjeta. Intenta de nuevo.',
        }
      }

      const profile = detail.creditCardProfile
      const result = analyzePurchase({
        amount: input.amount,
        installments: input.installments,
        statementDay: detail.statementDay,
        creditLimit: detail.creditLimit ? Number.parseFloat(detail.creditLimit) : null,
        currentBalance: Number.parseFloat(detail.currentBalance),
        interestRateMonthly: profile?.interestRateMonthly
          ? Number.parseFloat(profile.interestRateMonthly) / 100
          : null,
      })

      return {
        ok: true as const,
        analysis: {
          accountName: detail.name,
          currency: detail.currency,
          amount: input.amount,
          installments: input.installments,
          daysToStatement: result.daysToStatement,
          totalWithInterest: result.totalWithInterest,
          totalInterest: result.totalInterest,
          monthlyInstallment: result.monthlyInstallment,
          utilizationAfter: result.utilizationAfter,
          utilizationTone: result.utilizationTone,
          highlights: result.highlights,
          hasInterestRate: profile?.interestRateMonthly !== null && profile?.interestRateMonthly !== undefined,
        },
        message:
          'Análisis listo. La UI puede rendear esto como tarjeta o el copiloto puede leer `highlights` para sintetizar la respuesta.',
      }
    },
  })
}
