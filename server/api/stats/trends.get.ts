import { db } from '../../db'
import { meals, userGoals } from '../../db/schema'
import { eq, desc, sql, gte } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)
  const { days = 30 } = getQuery(event)
  const limit = Math.min(Number(days) || 30, 90)

  const since = new Date()
  since.setDate(since.getDate() - limit)
  const sinceStr = since.toISOString().split('T')[0]

  const [dailyData, goals] = await Promise.all([
    db
      .select({
        date: meals.date,
        totalCalories: sql<number>`ROUND(SUM(${meals.totalCalories}))`.as('total_calories'),
        totalProtein: sql<number>`ROUND(SUM(${meals.totalProtein})::numeric, 1)`.as('total_protein'),
        totalCarbs: sql<number>`ROUND(SUM(${meals.totalCarbs})::numeric, 1)`.as('total_carbs'),
        totalFat: sql<number>`ROUND(SUM(${meals.totalFat})::numeric, 1)`.as('total_fat'),
        mealCount: sql<number>`COUNT(*)`.as('meal_count')
      })
      .from(meals)
      .where(
        sql`${meals.userId} = ${session.user.id} AND ${meals.date} >= ${sinceStr}`
      )
      .groupBy(meals.date)
      .orderBy(desc(meals.date))
      .limit(limit),
    db.query.userGoals.findFirst({ where: eq(userGoals.userId, session.user.id) })
  ])

  const goal = goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 70 }

  const avg = dailyData.length > 0
    ? {
        calories: Math.round(dailyData.reduce((s, d) => s + d.totalCalories, 0) / dailyData.length),
        protein: Math.round(dailyData.reduce((s, d) => s + d.totalProtein, 0) / dailyData.length),
        carbs: Math.round(dailyData.reduce((s, d) => s + d.totalCarbs, 0) / dailyData.length),
        fat: Math.round(dailyData.reduce((s, d) => s + d.totalFat, 0) / dailyData.length)
      }
    : { calories: 0, protein: 0, carbs: 0, fat: 0 }

  return { days: dailyData, goals: goal, averages: avg }
})
