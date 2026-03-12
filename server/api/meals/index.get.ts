import { db } from '../../db'
import { meals, mealItems } from '../../db/schema'
import { eq, and, asc, inArray } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { date } = getQuery(event)

  const conditions = [eq(meals.userId, session.user.id)]
  if (date) {
    conditions.push(eq(meals.date, date as string))
  }

  const mealRows = await db
    .select()
    .from(meals)
    .where(and(...conditions))
    .orderBy(asc(meals.createdAt))

  if (mealRows.length === 0) return []

  const mealIds = mealRows.map(m => m.id)

  // Fetch all meal_items for these meals
  const allItems = await db
    .select()
    .from(mealItems)
    .where(inArray(mealItems.mealId, mealIds))

  // Group items by meal_id
  const itemsByMeal = new Map<string, typeof allItems>()
  for (const item of allItems) {
    const list = itemsByMeal.get(item.mealId) ?? []
    list.push(item)
    itemsByMeal.set(item.mealId, list)
  }

  return mealRows.map(meal => ({
    ...meal,
    items: (itemsByMeal.get(meal.id) ?? []).map(item => ({
      productId: item.productId,
      recipeId: item.recipeId,
      name: item.name,
      quantity: item.quantityText,
      quantityGrams: item.quantityGrams,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fat: item.fat,
      fiber: item.fiber,
      sugar: item.sugar,
      saturatedFat: item.saturatedFat,
      salt: item.salt,
      nutritionScore: item.nutritionScore,
      healthLabel: item.healthLabel
    }))
  }))
})
