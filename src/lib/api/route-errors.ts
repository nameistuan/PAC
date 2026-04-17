import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { flattenError, type ZodError } from 'zod'

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status })
}

export function validationError(zodError: ZodError) {
  return NextResponse.json(
    { error: 'Validation failed', issues: flattenError(zodError) },
    { status: 400 }
  )
}

export function isPrismaNotFound(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025'
}

export async function readJsonBody(request: Request): Promise<{ ok: true; data: unknown } | { ok: false; response: NextResponse }> {
  try {
    const data = await request.json()
    return { ok: true, data }
  } catch {
    return { ok: false, response: jsonError('Invalid JSON body', 400) }
  }
}