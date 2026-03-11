import { db } from '../../db'
import { meals } from '../../db/schema'
import { eq, and, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { date } = getQuery(event)

  const conditions = [eq(meals.userId, session.user.id)]
  if (date) {
    conditions.push(eq(meals.date, date as string))
  }

  const results = await db
    .select()
    .from(meals)
    .where(and(...conditions))
    .orderBy(asc(meals.createdAt))

  return results
})
