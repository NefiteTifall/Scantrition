import { db } from '../../db'
import { meals } from '../../db/schema'
import { eq, desc, sql } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  const results = await db
    .select({
      date: meals.date,
      totalCalories: sql<number>`SUM(${meals.totalCalories})`.as('total_calories'),
      totalProtein: sql<number>`SUM(${meals.totalProtein})`.as('total_protein'),
      totalCarbs: sql<number>`SUM(${meals.totalCarbs})`.as('total_carbs'),
      totalFat: sql<number>`SUM(${meals.totalFat})`.as('total_fat'),
      mealCount: sql<number>`COUNT(*)`.as('meal_count')
    })
    .from(meals)
    .where(eq(meals.userId, session.user.id))
    .groupBy(meals.date)
    .orderBy(desc(meals.date))
    .limit(90)

  return results
})
