import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { jsonError, readJsonBody, validationError } from '@/lib/api/route-errors'
import { projectCreateSchema } from '@/lib/validation/schemas'
import { getSessionUserId } from '@/lib/api/session'

export async function GET() {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  try {
    const projects = await prisma.project.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
    })
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return jsonError('Failed to fetch projects', 500)
  }
}

export async function POST(request: Request) {
  const userId = await getSessionUserId()
  if (userId instanceof Response) return userId

  const body = await readJsonBody(request)
  if (!body.ok) return body.response

  const parsed = projectCreateSchema.safeParse(body.data)
  if (!parsed.success) return validationError(parsed.error)

  const d = parsed.data
  try {
    const project = await prisma.project.create({
      data: {
        name: d.name,
        color: d.color ?? '#312E81',
        userId,
      },
    })

    return NextResponse.json(project, { status: 201 })
  } catch (error) {
    console.error('Failed to create project:', error)
    return jsonError('Failed to create project', 500)
  }
}
