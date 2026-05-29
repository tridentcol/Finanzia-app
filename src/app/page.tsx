import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'
import { auth } from '@clerk/nextjs/server'

import { BrandMark } from '@/components/brand/brand-mark'
import { BrandWordmark } from '@/components/brand/brand-wordmark'

const PILLARS = [
  {
    number: '∞',
    caption:
      'Cuentas en cualquier divisa, agregadas en una sola vista. La moneda no es la barrera, es el contexto.',
  },
  {
    number: 'IA',
    caption:
      'Que categoriza, anticipa y explica. Nunca mueve dinero sin tu confirmación; nunca opina sin que se lo pidas.',
  },
  {
    number: 'COP·USD',
    caption:
      'Todo tu portafolio en la moneda que piensas, no en la que registras. Conversión histórica preservada.',
  },
] as const

export default async function Home() {
  // Si ya hay sesión, no mostrar landing — la conversión ya ocurrió.
  // Saltamos directo a Hoy. Esto también arregla el caso PWA: cuando
  // el usuario abre la app desde el ícono del home screen, espera ver
  // su dashboard, no el pitch comercial.
  const { userId } = await auth()
  if (userId) {
    redirect('/dashboard')
  }

  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="border-border-default bg-background/85 sticky top-0 z-30 border-b backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-6 py-4 lg:px-8">
          <Link
            href="/"
            aria-label="finanzia"
            className="flex items-center gap-2"
          >
            <BrandMark size={28} />
            <BrandWordmark size={20} className="text-foreground" />
          </Link>
          <nav className="flex items-center gap-2 text-sm">
            <Show when="signed-out">
              <SignInButton mode="modal">
                <button
                  type="button"
                  className="text-text-secondary hover:text-text border-border-default hover:bg-surface-hover hidden cursor-pointer rounded-[8px] border px-4 py-2 transition-colors sm:inline-flex"
                >
                  Iniciar sesión
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="bg-foreground text-background cursor-pointer rounded-[8px] px-4 py-2 font-medium transition-opacity hover:opacity-90"
                >
                  Crear cuenta
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="bg-foreground text-background rounded-[8px] px-4 py-2 font-medium transition-opacity hover:opacity-90"
              >
                Abrir finanzia
              </Link>
              <UserButton
                appearance={{
                  elements: {
                    userButtonAvatarBox: { width: '28px', height: '28px' },
                  },
                }}
              />
            </Show>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-24 -right-20 opacity-[0.06] sm:-right-10 lg:right-0 lg:opacity-[0.08]"
          >
            <BrandMark size={560} />
          </div>

          <div className="relative mx-auto w-full max-w-[1240px] px-6 pt-20 pb-24 lg:px-8 lg:pt-32 lg:pb-36">
            <p className="text-text-tertiary mb-8 text-[11px] font-medium tracking-[0.18em] uppercase">
              Finanzas personales · 2026
            </p>
            <h1 className="display text-text max-w-3xl text-5xl leading-[0.96] tracking-[-0.04em] sm:text-7xl lg:text-[88px]">
              Tus finanzas,
              <br />
              con{' '}
              <span style={{ color: 'var(--brand-purple-soft)' }}>
                sentido
              </span>
              .
            </h1>
            <p className="text-text-secondary mt-10 max-w-xl text-base leading-relaxed sm:text-lg">
              Una bitácora editorial de tu dinero. Multi-divisa, multi-cuenta,
              asistida por inteligencia que no se mete donde no debe.
            </p>
            <div className="mt-12 flex flex-wrap items-center gap-3">
              <Show when="signed-out">
                <SignUpButton mode="modal">
                  <button
                    type="button"
                    className="bg-foreground text-background cursor-pointer rounded-[8px] px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                  >
                    Empieza gratis
                  </button>
                </SignUpButton>
                <SignInButton mode="modal">
                  <button
                    type="button"
                    className="text-text border-border-default hover:bg-surface-hover cursor-pointer rounded-[8px] border px-5 py-2.5 text-sm font-medium transition-colors"
                  >
                    Iniciar sesión
                  </button>
                </SignInButton>
              </Show>
              <Show when="signed-in">
                <Link
                  href="/dashboard"
                  className="bg-foreground text-background rounded-[8px] px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                >
                  Abrir finanzia
                </Link>
              </Show>
            </div>
          </div>
        </section>

        {/* Tinted band — pilares */}
        <section
          className="border-border-default border-y"
          style={{
            background:
              'color-mix(in oklab, var(--brand-purple-strong) 5%, transparent)',
          }}
        >
          <div className="mx-auto grid w-full max-w-[1240px] gap-12 px-6 py-20 sm:grid-cols-3 lg:px-8 lg:py-24">
            {PILLARS.map((pillar) => (
              <div key={pillar.number} className="flex flex-col gap-4">
                <span
                  className="display text-5xl tracking-tight sm:text-6xl"
                  style={{ color: 'var(--brand-purple-soft)' }}
                >
                  {pillar.number}
                </span>
                <p className="text-text-secondary max-w-sm text-base leading-relaxed">
                  {pillar.caption}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Cierre editorial */}
        <section className="mx-auto w-full max-w-[1240px] px-6 py-24 text-center lg:px-8 lg:py-32">
          <p className="editorial text-text mx-auto max-w-2xl text-2xl leading-snug sm:text-3xl lg:text-4xl">
            Tu dinero merece más que una hoja de cálculo.
          </p>
          <div className="mt-10">
            <Show when="signed-out">
              <SignUpButton mode="modal">
                <button
                  type="button"
                  className="bg-foreground text-background cursor-pointer rounded-[8px] px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
                >
                  Empieza ahora
                </button>
              </SignUpButton>
            </Show>
            <Show when="signed-in">
              <Link
                href="/dashboard"
                className="bg-foreground text-background rounded-[8px] px-5 py-2.5 text-sm font-medium transition-opacity hover:opacity-90"
              >
                Abrir finanzia
              </Link>
            </Show>
          </div>
        </section>
      </main>

      <footer className="border-border-default border-t">
        <div className="mx-auto flex w-full max-w-[1240px] items-center justify-between px-6 py-8 lg:px-8">
          <Link href="/" className="flex items-center gap-2 opacity-70">
            <BrandMark size={20} />
            <BrandWordmark size={14} className="text-text-secondary" />
          </Link>
          <p className="text-text-tertiary text-[12px]">
            © 2026 finanzia. Hecho en Colombia.
          </p>
        </div>
      </footer>
    </div>
  )
}
