import { db } from '../../db'
import { favoriteMeals } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!

  await db.delete(favoriteMeals).where(
    and(eq(favoriteMeals.id, id), eq(favoriteMeals.userId, session.user.id))
  )

  return { ok: true }
})
