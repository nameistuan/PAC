import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { cookies, headers } from 'next/headers'
import './globals.css'
import AppShell from '../components/AppShell'
import prisma from '@/lib/prisma'
import { auth } from '@/lib/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Juggle',
  description: 'Project management and calendar application for seamless scheduling',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // If not logged in, render children directly (login page handles its own UI)
  if (!session?.user?.id) {
    return (
      <html lang="en" className={inter.className}>
        <body>{children}</body>
      </html>
    )
  }

  const cookieStore = await cookies()
  const sidebarOpenStr = cookieStore.get('pac_sidebar_open')?.value
  const sidebarWidthStr = cookieStore.get('pac_sidebar_width')?.value
  const kanbanOpenStr = cookieStore.get('pac_kanban_open')?.value
  const kanbanWidthStr = cookieStore.get('pac_kanban_width')?.value
  const gridScaleStr = cookieStore.get('pac_grid_scale')?.value
  
  const defaultSidebarOpen = sidebarOpenStr !== 'false'
  const defaultSidebarWidth = sidebarWidthStr ? Number(sidebarWidthStr) : 250
  const defaultKanbanOpen = kanbanOpenStr === 'true'
  const defaultKanbanWidth = kanbanWidthStr ? Number(kanbanWidthStr) : 320
  const defaultGridScale = gridScaleStr ? Number(gridScaleStr) : 1

  const projects = await prisma.project.findMany({
    where: { userId: session.user.id },
    orderBy: { name: 'asc' },
  })

  return (
    <html lang="en" className={inter.className}>
      <body>
        <AppShell
          defaultSidebarOpen={defaultSidebarOpen}
          defaultSidebarWidth={defaultSidebarWidth}
          defaultKanbanOpen={defaultKanbanOpen}
          defaultKanbanWidth={defaultKanbanWidth}
          defaultGridScale={defaultGridScale}
          initialProjects={projects}
        >
          {children}
        </AppShell>
      </body>
    </html>
  )
}
