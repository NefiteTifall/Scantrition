import { db } from '../../db'
import { favoriteMeals } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  return db.query.favoriteMeals.findMany({
    where: eq(favoriteMeals.userId, session.user.id),
    orderBy: [desc(favoriteMeals.createdAt)]
  })
})
