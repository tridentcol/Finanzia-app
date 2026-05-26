import Link from 'next/link'
import { Show, SignInButton, SignUpButton, UserButton } from '@clerk/nextjs'

export default function Home() {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="flex items-center justify-between px-8 py-6">
        <span className="text-foreground text-sm font-semibold tracking-tight">
          Finanzia
        </span>
        <nav className="flex items-center gap-6 text-sm">
          <Show when="signed-out">
            <SignInButton mode="modal">
              <button
                type="button"
                className="text-foreground/80 hover:text-foreground cursor-pointer transition-colors"
              >
                Iniciar sesión
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button
                type="button"
                className="border-border bg-foreground text-background hover:bg-foreground/90 cursor-pointer rounded-lg border px-4 py-2 transition-colors"
              >
                Crear cuenta
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link
              href="/dashboard"
              className="border-border bg-foreground text-background hover:bg-foreground/90 rounded-lg border px-4 py-2 transition-colors"
            >
              Abrir Finanzia
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
      </header>
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 pb-24">
        <h1 className="display text-text text-5xl sm:text-7xl">
          Tus finanzas, con sentido.
        </h1>
        <p className="text-text-secondary mt-8 max-w-xl text-base leading-relaxed">
          Una bitácora editorial de tu dinero. Multi-divisa, multi-cuenta,
          asistida por inteligencia que no se mete donde no debe.
        </p>
      </main>
    </div>
  )
}
