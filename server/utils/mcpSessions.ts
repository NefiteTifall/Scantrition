import { db } from '../db'
import { mcpSessions } from '../db/schema'
import { eq, and, gt, lt } from 'drizzle-orm'

const SESSION_TTL_HOURS = 24

export async function createMCPSession(userId: string, protocolVersion: string): Promise<string> {
  const id = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000)

  await db.insert(mcpSessions).values({
    id,
    userId,
    protocolVersion: protocolVersion || '2025-11-25',
    expiresAt
  })

  return id
}

export async function getMCPSession(id: string): Promise<{ userId: string, protocolVersion: string } | null> {
  const session = await db.query.mcpSessions.findFirst({
    where: and(
      eq(mcpSessions.id, id),
      gt(mcpSessions.expiresAt, new Date())
    )
  })

  if (!session) return null

  // Update lastUsedAt asynchronously — non-blocking
  db.update(mcpSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(mcpSessions.id, id))
    .execute()
    .catch(() => {})

  return { userId: session.userId, protocolVersion: session.protocolVersion }
}

export async function deleteMCPSession(id: string): Promise<void> {
  await db.delete(mcpSessions).where(eq(mcpSessions.id, id))
}

// Called occasionally to purge expired sessions — can be triggered on initialize
export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(mcpSessions).where(lt(mcpSessions.expiresAt, new Date()))
}
