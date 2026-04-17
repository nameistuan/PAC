import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { resolveProjectIdForNewEvent } from '@/lib/api/resolve-event-project'
import { jsonError, readJsonBody, validationError } from '@/lib/api/route-errors'
import { eventCreateSchema } from '@/lib/validation/schemas'
import { getSessionUserId } from '@/lib/api/session'

const eventInclude = { project: true } as const

export async function GET(request: Request) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    const events = await prisma.event.findMany({
      where: {
        userId,
        ...(q ? { title: { contains: q } } : {}),
      },
      orderBy: { startTime: 'desc' },
      take: q ? 20 : undefined,
      include: eventInclude,
    })
    return NextResponse.json(events)
  } catch (error) {
    console.error('Failed to fetch events:', error)
    return jsonError('Failed to fetch events', 500)
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const parsed = eventCreateSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const d = parsed.data
  try {
    const projectId = await resolveProjectIdForNewEvent(d.taskId, d.projectId)

    const event = await prisma.event.create({
      data: {
        title: d.title,
        description: d.description ?? null,
        location: d.location ?? null,
        startTime: d.startTime,
        endTime: d.endTime,
        taskId: d.taskId ?? null,
        projectId,
        isFluid: d.isFluid ?? false,
        isAllDay: d.isAllDay ?? false,
        recurrenceRule: d.recurrenceRule ?? null,
        userId,
      },
      include: eventInclude,
    })

    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Failed to create event:', error)
    return jsonError('Failed to create event', 500)
  }
}
