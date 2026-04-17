import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Sign In — Juggle',
  description: 'Sign in to your Juggle account',
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Render children directly without the AppShell wrapper
  return children
}
