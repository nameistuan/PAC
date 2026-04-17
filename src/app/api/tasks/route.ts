import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { jsonError, readJsonBody, validationError } from '@/lib/api/route-errors'
import { taskCreateSchema } from '@/lib/validation/schemas'
import { getSessionUserId } from '@/lib/api/session'

const taskInclude = { project: true, subtasks: true } as const

export async function GET() {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  try {
    const tasks = await prisma.task.findMany({
      where: { userId },
      include: taskInclude,
      orderBy: { order: 'asc' },
    })
    return NextResponse.json(tasks)
  } catch (error) {
    console.error('Failed to fetch tasks:', error)
    return jsonError('Failed to fetch tasks', 500)
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const parsed = taskCreateSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const d = parsed.data
  try {
    const task = await prisma.task.create({
      data: {
        title: d.title,
        description: d.description ?? null,
        status: d.status ?? 'TODO',
        priority: d.priority ?? 'MEDIUM',
        dueDate: d.dueDate,
        plannedDate: d.plannedDate,
        projectId: d.projectId,
        order: d.order ?? 0,
        userId,
      },
      include: taskInclude,
    })

    return NextResponse.json(task, { status: 201 })
  } catch (error) {
    console.error('Failed to create task:', error)
    return jsonError('Failed to create task', 500)
  }
}
