import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.trim()

    const events = await prisma.event.findMany({
      where: q ? { title: { contains: q } } : undefined,
      orderBy: { startTime: 'desc' },
      take: q ? 20 : undefined,
      include: { project: true },
    })
    return NextResponse.json(events)
  } catch (error) {
    console.error('Failed to fetch events:', error)
    return NextResponse.json({ error: 'Failed to fetch events' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { title, description, location, startTime, endTime, taskId, projectId, isFluid } = body
    
    const event = await prisma.event.create({
      data: {
        title,
        description,
        location,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        taskId,
        projectId,
        isFluid: isFluid ?? false
      }
    })
    
    return NextResponse.json(event, { status: 201 })
  } catch (error) {
    console.error('Failed to create event:', error)
    return NextResponse.json({ error: 'Failed to create event' }, { status: 500 })
  }
}
