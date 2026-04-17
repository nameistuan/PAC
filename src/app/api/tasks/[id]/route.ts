import { NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  isPrismaNotFound,
  jsonError,
  readJsonBody,
  validationError,
} from '@/lib/api/route-errors'
import { taskUpdateSchema, type TaskUpdateInput } from '@/lib/validation/schemas'
import { getSessionUserId } from '@/lib/api/session'

const taskInclude = { project: true, subtasks: true } as const

function buildTaskUpdateInput(fields: Omit<TaskUpdateInput, 'updatedAt'>): Prisma.TaskUncheckedUpdateInput {
  const data: Prisma.TaskUncheckedUpdateInput = {}
  if (fields.title !== undefined) data.title = fields.title
  if (fields.description !== undefined) data.description = fields.description
  if (fields.status !== undefined) data.status = fields.status
  if (fields.priority !== undefined) data.priority = fields.priority
  if (fields.dueDate !== undefined) {
    data.dueDate = fields.dueDate === null ? null : fields.dueDate
  }
  if (fields.plannedDate !== undefined) {
    data.plannedDate = fields.plannedDate
  }
  if (fields.projectId !== undefined) {
    data.projectId = fields.projectId
  }
  if (fields.order !== undefined) data.order = fields.order
  return data
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  const { id } = await params
  try {
    const task = await prisma.task.findUnique({
      where: { id, userId },
      include: taskInclude,
    })
    if (!task) return jsonError('Task not found', 404)
    return NextResponse.json(task)
  } catch (error) {
    console.error('Failed to fetch task:', error)
    return jsonError('Failed to fetch task', 500)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  const { id } = await params
  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const parsed = taskUpdateSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const { updatedAt, ...rest } = parsed.data
  const updateInput = buildTaskUpdateInput(rest)

  if (Object.keys(updateInput).length === 0) {
    return jsonError('No fields to update', 400)
  }

  try {
    if (updatedAt !== undefined) {
      const clientTs = updatedAt instanceof Date ? updatedAt : new Date(String(updatedAt))
      const result = await prisma.task.updateMany({
        where: { id, updatedAt: clientTs, userId },
        data: updateInput,
      })
      if (result.count === 0) {
        const row = await prisma.task.findUnique({ where: { id } })
        if (!row) return jsonError('Task not found', 404)
        return jsonError('Resource was modified by another change', 409, { code: 'CONFLICT' })
      }
      const task = await prisma.task.findUnique({
        where: { id },
        include: taskInclude,
      })

      if (updateInput.title !== undefined || updateInput.description !== undefined) {
        await prisma.event.updateMany({
          where: { taskId: id },
          data: {
            ...(updateInput.title !== undefined && { title: updateInput.title as string }),
            ...(updateInput.description !== undefined && { description: updateInput.description as string | null })
          }
        })
      }

      return NextResponse.json(task)
    }

    const task = await prisma.task.update({
      where: { id, userId },
      data: updateInput,
      include: taskInclude,
    })

    if (updateInput.title !== undefined || updateInput.description !== undefined) {
      await prisma.event.updateMany({
        where: { taskId: id },
        data: {
          ...(updateInput.title !== undefined && { title: updateInput.title as string }),
          ...(updateInput.description !== undefined && { description: updateInput.description as string | null })
        }
      })
    }

    return NextResponse.json(task)
  } catch (error) {
    if (isPrismaNotFound(error)) return jsonError('Task not found', 404)
    console.error('Failed to update task:', error)
    return jsonError('Failed to update task', 500)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  const { id } = await params
  try {
    await prisma.task.delete({ where: { id, userId } })
    return NextResponse.json({ success: true })
  } catch (error) {
    if (isPrismaNotFound(error)) return jsonError('Task not found', 404)
    console.error('Failed to delete task:', error)
    return jsonError('Failed to delete task', 500)
  }
}
