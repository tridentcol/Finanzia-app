import Link from 'next/link'

import { BrandMark } from '@/components/brand/brand-mark'
import { BrandWordmark } from '@/components/brand/brand-wordmark'

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
          aria-label="finanzia"
          className="flex items-center gap-2"
        >
          <BrandMark size={24} />
          <BrandWordmark size={18} className="text-foreground" />
        </Link>
      </header>
      <main className="flex flex-1 items-center justify-center px-6 pb-16">
        {children}
      </main>
    </div>
  )
}
