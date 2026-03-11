import { db } from '../../../db'
import { userApiKeys } from '../../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id')!

  await db.delete(userApiKeys).where(
    and(eq(userApiKeys.id, id), eq(userApiKeys.userId, session.user.id))
  )

  return { ok: true }
})
