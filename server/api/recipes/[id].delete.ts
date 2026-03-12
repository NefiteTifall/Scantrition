import { db } from '../../db'
import { recipes } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id')!

  const [recipe] = await db
    .select({ id: recipes.id })
    .from(recipes)
    .where(and(eq(recipes.id, id), eq(recipes.userId, session.user.id)))
    .limit(1)

  if (!recipe) throw createError({ statusCode: 404, message: 'Recipe not found' })

  await db.delete(recipes).where(eq(recipes.id, id))
  return { success: true }
})
