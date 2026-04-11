'use server'

import prisma from './prisma'

export async function getKanbanTasks() {
  return prisma.task.findMany({
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
