import { db } from '../../../db'
import { userApiKeys } from '../../../db/schema'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const keys = await db.query.userApiKeys.findMany({
    where: eq(userApiKeys.userId, session.user.id),
    orderBy: [desc(userApiKeys.createdAt)]
  })
  return keys.map(k => ({
    id: k.id,
    name: k.name,
    prefix: k.prefix,
    createdAt: k.createdAt,
    lastUsedAt: k.lastUsedAt
  }))
})
