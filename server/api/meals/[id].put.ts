import { db } from '../../db'
import { meals } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id')!
  const { totalCalories, totalProtein, totalCarbs, totalFat, totalFiber, totalSugar, totalSaturatedFat, totalSalt, nutriScore, healthScore, healthLabel, items, mealCategory } = await readBody(event)

  const [updated] = await db.update(meals)
    .set({
      totalCalories,
      totalProtein,
      totalCarbs,
      totalFat,
      ...(totalFiber != null ? { totalFiber } : {}),
      ...(totalSugar != null ? { totalSugar } : {}),
      ...(totalSaturatedFat != null ? { totalSaturatedFat } : {}),
      ...(totalSalt != null ? { totalSalt } : {}),
      ...(nutriScore !== undefined ? { nutriScore: nutriScore ?? null } : {}),
      ...(healthScore != null ? { healthScore } : {}),
      ...(healthLabel !== undefined ? { healthLabel: healthLabel ?? null } : {}),
      ...(items ? { items } : {}),
      ...(mealCategory !== undefined ? { mealCategory: mealCategory ?? null } : {})
    })
    .where(and(eq(meals.id, id), eq(meals.userId, session.user.id)))
    .returning()

  if (!updated) throw createError({ statusCode: 404, message: 'Meal not found' })
  return updated
})
