import type { Metadata } from 'next'
import { SignIn } from '@clerk/nextjs'

export const metadata: Metadata = {
  title: 'Iniciar sesión',
}

export default function SignInPage() {
  return <SignIn />
}
