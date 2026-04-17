import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import {
  isPrismaNotFound,
  jsonError,
  readJsonBody,
  validationError,
} from '@/lib/api/route-errors'
import { eventUpdateSchema, type EventUpdateInput } from '@/lib/validation/schemas'
import { getSessionUserId } from '@/lib/api/session'

const eventInclude = { project: true } as const

function buildEventUpdateData(
  fields: Omit<EventUpdateInput, 'updatedAt'>
): Prisma.EventUncheckedUpdateInput {
  const data: Prisma.EventUncheckedUpdateInput = {}
  if (fields.title !== undefined) data.title = fields.title
  if (fields.description !== undefined) data.description = fields.description
  if (fields.location !== undefined) data.location = fields.location
  if (fields.startTime !== undefined) data.startTime = fields.startTime
  if (fields.endTime !== undefined) data.endTime = fields.endTime
  if (fields.taskId !== undefined) data.taskId = fields.taskId
  if (fields.projectId !== undefined) data.projectId = fields.projectId
  if (fields.isFluid !== undefined) data.isFluid = fields.isFluid
  if (fields.isAllDay !== undefined) data.isAllDay = fields.isAllDay
  if (fields.recurrenceRule !== undefined) data.recurrenceRule = fields.recurrenceRule
  return data
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  try {
    const { id } = await params
    const event = await prisma.event.findUnique({
      where: { id, userId },
      include: eventInclude,
    })

    if (!event) {
      return jsonError('Event not found', 404)
    }

    return NextResponse.json(event)
  } catch (error) {
    console.error('Failed to fetch event:', error)
    return jsonError('Failed to fetch event', 500)
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

  const parsed = eventUpdateSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const { updatedAt, ...rest } = parsed.data
  const updateFields = buildEventUpdateData(rest)

  if (Object.keys(updateFields).length === 0) {
    return jsonError('No fields to update', 400)
  }

  try {
    const existing = await prisma.event.findUnique({ where: { id, userId } })
    if (!existing) return jsonError('Event not found', 404)

    const start = rest.startTime ?? existing.startTime
    const end = rest.endTime ?? existing.endTime
    if (end <= start) {
      return jsonError('endTime must be after startTime', 400)
    }

    if (updatedAt !== undefined) {
      const clientTs = updatedAt instanceof Date ? updatedAt : new Date(String(updatedAt))
      const result = await prisma.event.updateMany({
        where: { id, updatedAt: clientTs, userId },
        data: updateFields,
      })
      if (result.count === 0) {
        const row = await prisma.event.findUnique({ where: { id } })
        if (!row) return jsonError('Event not found', 404)
        return jsonError('Resource was modified by another change', 409, { code: 'CONFLICT' })
      }
      const event = await prisma.event.findUnique({
        where: { id },
        include: eventInclude,
      })

      if (event?.taskId && (updateFields.title !== undefined || updateFields.description !== undefined)) {
        await prisma.task.update({
          where: { id: event.taskId },
          data: {
            ...(updateFields.title !== undefined && { title: updateFields.title as string }),
            ...(updateFields.description !== undefined && { description: updateFields.description as string | null })
          }
        })
        await prisma.event.updateMany({
          where: { taskId: event.taskId, id: { not: id } },
          data: {
            ...(updateFields.title !== undefined && { title: updateFields.title as string }),
            ...(updateFields.description !== undefined && { description: updateFields.description as string | null })
          }
        })
      }

      return NextResponse.json(event)
    }

    const event = await prisma.event.update({
      where: { id },
      data: updateFields,
      include: eventInclude,
    })

    if (event.taskId && (updateFields.title !== undefined || updateFields.description !== undefined)) {
      await prisma.task.update({
        where: { id: event.taskId },
        data: {
          ...(updateFields.title !== undefined && { title: updateFields.title as string }),
          ...(updateFields.description !== undefined && { description: updateFields.description as string | null })
        }
      })
      await prisma.event.updateMany({
        where: { taskId: event.taskId, id: { not: id } },
        data: {
          ...(updateFields.title !== undefined && { title: updateFields.title as string }),
          ...(updateFields.description !== undefined && { description: updateFields.description as string | null })
        }
      })
    }

    return NextResponse.json(event)
  } catch (error) {
    if (isPrismaNotFound(error)) return jsonError('Event not found', 404)
    console.error('Failed to update event:', error)
    return jsonError('Failed to update event', 500)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  try {
    const { id } = await params
    await prisma.event.delete({
      where: { id, userId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (isPrismaNotFound(error)) return jsonError('Event not found', 404)
    console.error('Failed to delete event:', error)
    return jsonError('Failed to delete event', 500)
  }
}
