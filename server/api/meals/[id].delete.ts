import { db } from '../../db'
import { meals } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')

  if (!id) {
    throw createError({ statusCode: 400, message: 'Missing meal id' })
  }

  await db
    .delete(meals)
    .where(and(eq(meals.id, id), eq(meals.userId, session.user.id)))

  return { success: true }
})
