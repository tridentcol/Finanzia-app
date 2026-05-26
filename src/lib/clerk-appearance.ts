import type { ComponentProps } from 'react'
import type { ClerkProvider } from '@clerk/nextjs'

type Appearance = NonNullable<ComponentProps<typeof ClerkProvider>['appearance']>

/**
 * Apariencia de Clerk alineada al Mandato Estético Noir.
 *
 * Reglas que se aplican aquí:
 *  - Cero saturación alta. Cero gradientes, glow ni shadow.
 *  - Botón primario = fill texto sobre superficie oscura (estilo Linear/Mercury),
 *    NO el `accent-ai` (reservado a presencia de IA).
 *  - Border 1px en todo. Radius 8 (botones/inputs), 12 (cards).
 *  - Tipografía: Inter (system var --font-sans). Sin uppercase.
 */
export const clerkAppearance: Appearance = {
  variables: {
    colorPrimary: '#FAFAFA',
    colorBackground: '#141416',
    colorInputBackground: '#0A0A0B',
    colorInputText: '#FAFAFA',
    colorText: '#FAFAFA',
    colorTextSecondary: '#A1A1A8',
    colorTextOnPrimaryBackground: '#0A0A0B',
    colorNeutral: '#FAFAFA',
    colorDanger: '#D4938A',
    colorSuccess: '#7FB89F',
    colorWarning: '#D4B58A',
    borderRadius: '8px',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    spacingUnit: '1rem',
  },
  elements: {
    rootBox: {
      width: '100%',
    },
    card: {
      backgroundColor: '#141416',
      border: '1px solid #26262A',
      borderRadius: '12px',
      boxShadow: 'none',
    },
    headerTitle: {
      color: '#FAFAFA',
      fontSize: '20px',
      fontWeight: 600,
      letterSpacing: '-0.01em',
    },
    headerSubtitle: {
      color: '#A1A1A8',
      fontSize: '14px',
    },
    socialButtonsBlockButton: {
      backgroundColor: '#1C1C1F',
      border: '1px solid #26262A',
      color: '#FAFAFA',
      textTransform: 'none',
      boxShadow: 'none',
      '&:hover': {
        backgroundColor: '#222226',
      },
    },
    socialButtonsBlockButtonText: {
      fontWeight: 500,
    },
    dividerLine: {
      backgroundColor: '#26262A',
    },
    dividerText: {
      color: '#6B6B72',
    },
    formFieldLabel: {
      color: '#A1A1A8',
      fontSize: '13px',
      fontWeight: 500,
    },
    formFieldInput: {
      backgroundColor: '#0A0A0B',
      border: '1px solid #26262A',
      color: '#FAFAFA',
      height: '40px',
      boxShadow: 'none',
      '&:focus': {
        borderColor: '#34343A',
        boxShadow: 'none',
      },
    },
    formButtonPrimary: {
      backgroundColor: '#FAFAFA',
      color: '#0A0A0B',
      textTransform: 'none',
      boxShadow: 'none',
      fontWeight: 500,
      height: '40px',
      '&:hover': {
        backgroundColor: '#E5E5E7',
      },
      '&:focus': {
        boxShadow: 'none',
      },
      '&:active': {
        backgroundColor: '#D4D4D6',
      },
    },
    footerActionText: {
      color: '#A1A1A8',
    },
    footerActionLink: {
      color: '#FAFAFA',
      textDecoration: 'underline',
      textUnderlineOffset: '2px',
      '&:hover': {
        color: '#FAFAFA',
      },
    },
    identityPreviewText: {
      color: '#FAFAFA',
    },
    identityPreviewEditButton: {
      color: '#A1A1A8',
    },
    formFieldErrorText: {
      color: '#D4938A',
    },
    alert: {
      backgroundColor: '#1C1C1F',
      border: '1px solid #26262A',
      color: '#FAFAFA',
    },
  },
  layout: {
    socialButtonsPlacement: 'top',
    socialButtonsVariant: 'blockButton',
    showOptionalFields: false,
  },
}
