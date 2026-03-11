import { db } from '../../db'
import { meals } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const id = getRouterParam(event, 'id')!
  const { totalCalories, totalProtein, totalCarbs, totalFat, items, mealCategory } = await readBody(event)

  const [updated] = await db.update(meals)
    .set({
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      ...(items ? { items } : {}),
      ...(mealCategory !== undefined ? { mealCategory: mealCategory ?? null } : {})
    })
    .where(and(eq(meals.id, id), eq(meals.userId, session.user.id)))
    .returning()

  if (!updated) throw createError({ statusCode: 404, message: 'Meal not found' })
  return updated
})
