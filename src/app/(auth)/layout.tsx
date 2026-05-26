import Link from 'next/link'

export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="bg-background flex min-h-svh flex-col">
      <header className="px-8 py-6">
        <Link
          href="/"
          className="text-foreground text-sm font-semibold tracking-tight"
        >
          Finanzia
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {children}
      </main>
    </div>
  )
}
