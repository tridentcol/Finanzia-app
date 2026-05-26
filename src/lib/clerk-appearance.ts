import type { ComponentProps } from 'react'
import type { ClerkProvider } from '@clerk/nextjs'

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>

/**
 * Apariencia de Clerk alineada al Mandato Estético Noir.
 *
 * Valores cromáticos por CSS vars (definidas en `src/app/globals.css`) para
 * que cualquier ajuste futuro al theme se propague automáticamente al UI
 * de Clerk. Cero gradientes, glow, shadow, uppercase.
 *
 * Botón primario = fill `--text` sobre `--bg` (estilo Linear/Mercury). NO
 * usamos `--accent-ai` — está reservado a presencia de IA.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: 'var(--text)',
    colorBackground: 'var(--surface)',
    colorInputBackground: 'var(--bg)',
    colorInputText: 'var(--text)',
    colorText: 'var(--text)',
    colorTextSecondary: 'var(--text-secondary)',
    colorTextOnPrimaryBackground: 'var(--bg)',
    colorNeutral: 'var(--text)',
    colorDanger: 'var(--negative)',
    colorSuccess: 'var(--positive)',
    colorWarning: 'var(--warning)',
    borderRadius: 'var(--radius-control)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    spacingUnit: '1rem',
  },
  elements: {
    rootBox: {
      width: '100%',
    },
    card: {
      backgroundColor: 'var(--surface)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-card)',
      boxShadow: 'none',
    },
    headerTitle: {
      color: 'var(--text)',
      fontSize: '20px',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    headerSubtitle: {
      color: 'var(--text-secondary)',
      fontSize: '14px',
    },
    socialButtonsBlockButton: {
      backgroundColor: 'var(--surface-elevated)',
      border: '1px solid var(--border-default)',
      color: 'var(--text)',
      textTransform: 'none',
      boxShadow: 'none',
      '&:hover': {
        backgroundColor: 'var(--surface-hover)',
      },
    },
    socialButtonsBlockButtonText: {
      fontWeight: 500,
    },
    dividerLine: {
      backgroundColor: 'var(--border-default)',
    },
    dividerText: {
      color: 'var(--text-tertiary)',
    },
    formFieldLabel: {
      color: 'var(--text-secondary)',
      fontSize: '13px',
      fontWeight: 500,
    },
    formFieldInput: {
      backgroundColor: 'var(--bg)',
      border: '1px solid var(--border-default)',
      color: 'var(--text)',
      height: '40px',
      boxShadow: 'none',
      '&:focus': {
        borderColor: 'var(--border-emphasis)',
        boxShadow: 'none',
      },
    },
    formButtonPrimary: {
      backgroundColor: 'var(--text)',
      color: 'var(--bg)',
      textTransform: 'none',
      boxShadow: 'none',
      fontWeight: 500,
      height: '40px',
      '&:hover': {
        opacity: 0.9,
      },
      '&:focus': {
        boxShadow: 'none',
      },
      '&:active': {
        opacity: 0.8,
      },
    },
    footerActionText: {
      color: 'var(--text-secondary)',
    },
    footerActionLink: {
      color: 'var(--text)',
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
      '&:hover': {
        color: 'var(--text)',
      },
    },
    identityPreviewText: {
      color: 'var(--text)',
    },
    identityPreviewEditButton: {
      color: 'var(--text-secondary)',
    },
    formFieldErrorText: {
      color: 'var(--negative)',
    },
    alert: {
      backgroundColor: 'var(--surface-elevated)',
      border: '1px solid var(--border-default)',
      color: 'var(--text)',
    },
  },
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    showOptionalFields: false,
  },
}
