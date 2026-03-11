import { db } from '../../db'
import { meals } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const body = await readBody(event)

  if (!body.date || !body.type || !body.items) {
    throw createError({ statusCode: 400, message: 'Missing required fields' })
  }

  const [meal] = await db
    .insert(meals)
    .values({
      userId: session.user.id,
      date: body.date,
      type: body.type,
      mealCategory: body.mealCategory ?? null,
      label: body.label ?? null,
      items: body.items,
      totalCalories: Math.round(body.totalCalories),
      totalProtein: Math.round(body.totalProtein * 10) / 10,
      totalCarbs: Math.round(body.totalCarbs * 10) / 10,
      totalFat: Math.round(body.totalFat * 10) / 10,
      confidence: body.confidence ?? 1,
      source: body.source ?? null
    })
    .returning()

  return meal
})
