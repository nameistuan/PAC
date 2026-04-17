import { auth } from "@/lib/auth"
import { jsonError } from "@/lib/api/route-errors"

/**
 * Returns the authenticated user's ID.
 * If not authenticated, returns a NextResponse error (401).
 * Usage:
 *   const userId = await getSessionUserId()
 *   if (userId instanceof Response) return userId
 */
export async function getSessionUserId(): Promise<string | Response> {
  const session = await auth()
  if (!session?.user?.id) {
    return jsonError("Unauthorized", 401)
  }
  return session.user.id
}
