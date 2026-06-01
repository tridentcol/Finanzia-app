'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { and, eq, isNull } from 'drizzle-orm'

import { requireCurrentUser } from '@/lib/auth'
import { revalidateUserData } from '@/lib/cache/data'
import { db } from '@/lib/db/client'
import { profiles, savingsPlans } from '@/lib/db/schema'
import {
  COMM_STYLE,
  FOCUS,
  HORIZON,
  LITERACY,
  MONEY_STYLE,
  derivePersona,
  testAnswersSchema,
} from '@/lib/ai/copilot/persona'

type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } }

// Señales de persona capturadas en el onboarding (las derivadas se calculan en
// el server). El test viene como respuestas crudas para re-derivar/editar.
const onboardingPersonaSchema = z.object({
  literacy: z.enum(LITERACY).optional(),
  commStyle: z.enum(COMM_STYLE).optional(),
  focus: z.array(z.enum(FOCUS)).max(2).optional(),
  testAnswers: testAnswersSchema.optional(),
})

const onboardingSchema = z.object({
  baseCurrency: z.enum(['COP', 'USD', 'EUR', 'MXN']),
  locale: z.enum(['es-CO', 'es-ES', 'en-US', 'es-MX']),
  incomeRange: z
    .enum(['under_2m', '2m_5m', '5m_10m', '10m_20m', 'over_20m', 'prefer_not'])
    .optional()
    .nullable(),
  method: z.enum(['percentage_income', 'fixed_amount', 'none', 'other']),
  params: z
    .union([
      z.object({ percent: z.number().min(1).max(100) }),
      z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/), frequency: z.literal('monthly') }),
    ])
    .optional()
    .nullable(),
  persona: onboardingPersonaSchema.optional().nullable(),
})

export type OnboardingInput = z.input<typeof onboardingSchema>

export async function completeOnboarding(input: OnboardingInput): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = onboardingSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.' } }
  }

  const { baseCurrency, locale, incomeRange, method, params, persona } = parsed.data

  try {
    await db.transaction(async (tx) => {
      // Lock de fila (FOR UPDATE): serializa el read-modify-write de aiProfile
      // con otros writers (updateFinancialPersona/updateCopilotPreferences) y
      // cierra la ventana de lost-update.
      const [existing] = await tx
        .select({ aiProfile: profiles.aiProfile })
        .from(profiles)
        .where(eq(profiles.userId, user.id))
        .for('update')

      const aiProfile: Record<string, unknown> = {
        ...((existing?.aiProfile as Record<string, unknown> | null) ?? {}),
        ...(incomeRange ? { incomeRange } : {}),
      }

      if (persona) {
        const derived = derivePersona(persona.testAnswers ?? {})
        const personaObj: Record<string, unknown> = { updatedAt: new Date().toISOString() }
        if (persona.literacy) personaObj.literacy = persona.literacy
        if (persona.commStyle) personaObj.commStyle = persona.commStyle
        if (persona.focus && persona.focus.length > 0) personaObj.focus = persona.focus
        if (persona.testAnswers) personaObj.testAnswers = persona.testAnswers
        if (derived.moneyStyle) personaObj.moneyStyle = derived.moneyStyle
        if (derived.horizon) personaObj.horizon = derived.horizon
        // Sólo persiste si hay alguna señal real (más allá de updatedAt).
        if (Object.keys(personaObj).length > 1) aiProfile.persona = personaObj
        // riskTolerance se escribe top-level: lo lee el snapshot legacy.
        if (derived.riskTolerance) aiProfile.riskTolerance = derived.riskTolerance
      }

      await tx
        .update(profiles)
        .set({
          baseCurrency,
          locale,
          aiProfile,
          onboardedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profiles.userId, user.id))

      await tx.insert(savingsPlans).values({
        userId: user.id,
        method,
        params: params ?? null,
        activeFrom: new Date().toISOString().slice(0, 10),
      })
    })

    revalidatePath('/', 'layout')
    revalidateUserData(user.id)
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: { code: 'DB_ERROR', message: 'Error al guardar. Intenta de nuevo.' } }
  }
}

const updatePlanSchema = z.object({
  method: z.enum(['percentage_income', 'fixed_amount', 'none', 'other']),
  params: z
    .union([
      z.object({ percent: z.number().min(1).max(100) }),
      z.object({ amount: z.string().regex(/^\d+(\.\d{1,2})?$/), frequency: z.literal('monthly') }),
    ])
    .optional()
    .nullable(),
})

export type UpdatePlanInput = z.input<typeof updatePlanSchema>

export async function updateSavingsPlan(input: UpdatePlanInput): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = updatePlanSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.' } }
  }

  const today = new Date().toISOString().slice(0, 10)

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(savingsPlans)
        .set({ activeTo: today })
        .where(and(eq(savingsPlans.userId, user.id), isNull(savingsPlans.activeTo)))

      await tx.insert(savingsPlans).values({
        userId: user.id,
        method: parsed.data.method,
        params: parsed.data.params ?? null,
        activeFrom: today,
      })
    })

    revalidatePath('/ajustes/perfil-financiero')
    revalidateUserData(user.id)
    return { ok: true, data: undefined }
  } catch {
    return { ok: false, error: { code: 'DB_ERROR', message: 'Error al guardar. Intenta de nuevo.' } }
  }
}

export async function getActiveSavingsPlan(userId: string) {
  return db.query.savingsPlans.findFirst({
    where: and(eq(savingsPlans.userId, userId), isNull(savingsPlans.activeTo)),
    orderBy: (t, { desc }) => [desc(t.activeFrom)],
  })
}

const financialPersonaSchema = z.object({
  mainGoal: z.string().max(140).nullable().optional(),
  riskTolerance: z.enum(['conservador', 'moderado', 'agresivo']).nullable().optional(),
  // Señales de persona editables desde Ajustes (sin repetir el mini-test).
  literacy: z.enum(LITERACY).nullable().optional(),
  commStyle: z.enum(COMM_STYLE).nullable().optional(),
  moneyStyle: z.enum(MONEY_STYLE).nullable().optional(),
  horizon: z.enum(HORIZON).nullable().optional(),
  focus: z.array(z.enum(FOCUS)).max(2).nullable().optional(),
})

export type FinancialPersonaInput = z.input<typeof financialPersonaSchema>

/**
 * Guarda señales de personalización del usuario en `profiles.aiProfile`. Los
 * legacy `mainGoal`/`riskTolerance` viven top-level (los lee el snapshot); las
 * señales de persona (literacy/commStyle/moneyStyle/horizon/focus) viven en
 * `aiProfile.persona`. Un campo `undefined` se deja como está; `null` o vacío lo
 * borra; un valor lo fija. El profile snapshot y los tone hints las inyectan.
 */
export async function updateFinancialPersona(
  input: FinancialPersonaInput,
): Promise<ActionResult> {
  const user = await requireCurrentUser()
  const parsed = financialPersonaSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, error: { code: 'VALIDATION_ERROR', message: 'Datos inválidos.' } }
  }
  const { mainGoal, riskTolerance, literacy, commStyle, moneyStyle, horizon, focus } = parsed.data

  try {
    // Transacción + lock de fila: el read-modify-write de aiProfile se serializa
    // con otros writers (p. ej. updateCopilotPreferences) y evita lost-update.
    await db.transaction(async (tx) => {
      const [row] = await tx
        .select({ aiProfile: profiles.aiProfile })
        .from(profiles)
        .where(eq(profiles.userId, user.id))
        .for('update')
      const aiProfile: Record<string, unknown> = {
        ...((row?.aiProfile as Record<string, unknown> | null) ?? {}),
      }
      // Legacy top-level (sólo si el campo viene en el input).
      if (mainGoal !== undefined) {
        if (mainGoal && mainGoal.trim()) aiProfile.mainGoal = mainGoal.trim()
        else delete aiProfile.mainGoal
      }
      if (riskTolerance !== undefined) {
        if (riskTolerance) aiProfile.riskTolerance = riskTolerance
        else delete aiProfile.riskTolerance
      }

      // Persona: merge campo a campo (undefined = no tocar, null/vacío = borrar).
      const persona: Record<string, unknown> = {
        ...((aiProfile.persona as Record<string, unknown> | null) ?? {}),
      }
      const setOrDelete = (key: string, val: string | string[] | null | undefined) => {
        if (val === undefined) return
        if (val === null || (Array.isArray(val) && val.length === 0)) delete persona[key]
        else persona[key] = val
      }
      setOrDelete('literacy', literacy)
      setOrDelete('commStyle', commStyle)
      setOrDelete('moneyStyle', moneyStyle)
      setOrDelete('horizon', horizon)
      setOrDelete('focus', focus)

      // Mantener testAnswers/derivados previos; sólo re-sellar updatedAt si queda
      // alguna señal. Sin señales ⇒ se borra el objeto persona.
      const hasSignal = Object.keys(persona).some((k) => k !== 'updatedAt')
      if (hasSignal) {
        persona.updatedAt = new Date().toISOString()
        aiProfile.persona = persona
      } else {
        delete aiProfile.persona
      }

      await tx
        .update(profiles)
        .set({ aiProfile, updatedAt: new Date() })
        .where(eq(profiles.userId, user.id))
    })
  } catch {
    return { ok: false, error: { code: 'DB_ERROR', message: 'Error al guardar. Intenta de nuevo.' } }
  }

  revalidatePath('/ajustes')
  return { ok: true, data: undefined }
}
