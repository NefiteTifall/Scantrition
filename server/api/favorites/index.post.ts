import { db } from '../../db'
import { favoriteMeals } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { name, items, totalCalories, totalProtein, totalCarbs, totalFat } = await readBody(event)

  if (!name?.trim()) throw createError({ statusCode: 400, message: 'Name is required' })

  const [fav] = await db.insert(favoriteMeals).values({
    userId: session.user.id,
    name: name.trim(),
    items,
    totalCalories,
    totalProtein,
    totalCarbs,
    totalFat
  }).returning()

  return fav
})
