import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies } from 'next/headers'
import './globals.css'
import AppShell from '../components/AppShell'
import prisma from '@/lib/prisma'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PAC | Personalized Assisted Calendar',
  description: 'Project management and calendar application with AI integration',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const sidebarOpenStr = cookieStore.get('pac_sidebar_open')?.value
  const sidebarWidthStr = cookieStore.get('pac_sidebar_width')?.value
  
  const defaultSidebarOpen = sidebarOpenStr !== 'false'
  const defaultSidebarWidth = sidebarWidthStr ? Number(sidebarWidthStr) : 250

  const projects = await prisma.project.findMany({ orderBy: { name: 'asc' } })

  return (
    <html lang="en" className={inter.className}>
      <body>
        <AppShell
          defaultSidebarOpen={defaultSidebarOpen}
          defaultSidebarWidth={defaultSidebarWidth}
          initialProjects={projects}
        >
          {children}
        </AppShell>
      </body>
    </html>
  )
}
