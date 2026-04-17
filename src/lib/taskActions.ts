'use server'

import prisma from './prisma'
import { auth } from '@/lib/auth'

export async function getKanbanTasks() {
  const session = await auth()
  const userId = session?.user?.id
  return prisma.task.findMany({
    where: userId ? { userId } : {},
    orderBy: { order: 'asc' },
    include: { project: true }
  })
}

export async function updateTaskStatus(taskId: string, newStatus: string) {
  return prisma.task.update({
    where: { id: taskId },
    data: { status: newStatus }
  })
}
