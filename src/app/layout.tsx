import type { Metadata } from 'next'
import { Inter, Geist_Mono, Fraunces } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import { esES } from '@clerk/localizations'
import { Toaster } from 'sonner'

import './globals.css'
import { clerkAppearance } from '@/lib/clerk-appearance'
import { TooltipProvider } from '@/components/ui/tooltip'

const inter = Inter({
  variable: '--font-sans',
  subsets: ['latin'],
  display: 'swap',
  axes: ['opsz'],
})

const geistMono = Geist_Mono({
  variable: '--font-mono',
  subsets: ['latin'],
  display: 'swap',
})

// Fraunces italic — uso parsimonioso. Solo para empty states y onboarding.
const fraunces = Fraunces({
  variable: '--font-editorial',
  subsets: ['latin'],
  display: 'swap',
  style: ['italic'],
  weight: ['400', '500'],
})

export const metadata: Metadata = {
  title: {
    default: 'Finanzia',
    template: '%s · Finanzia',
  },
  description: 'Finanzas personales con IA.',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="es"
      className={`dark ${inter.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="bg-background text-foreground flex min-h-full flex-col">
        <ClerkProvider appearance={clerkAppearance} localization={esES}>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        </ClerkProvider>
        <Toaster
          theme="dark"
          position="top-center"
          offset={20}
          toastOptions={{
            classNames: {
              toast:
                'border-border-default bg-surface-elevated text-text rounded-[12px] border shadow-none',
              description: 'text-text-secondary',
            },
          }}
        />
      </body>
    </html>
  )
}
