import { getAIProvider } from '../../utils/ai'
import { db } from '../../db'
import { userGoals, meals } from '../../db/schema'
import { eq, sql } from 'drizzle-orm'

export interface RecipeSuggestion {
  name: string
  description: string
  calories: number
  protein: number
  carbs: number
  fat: number
}

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const today = new Date().toISOString().split('T')[0]

  const [goals, [consumed]] = await Promise.all([
    db.query.userGoals.findFirst({ where: eq(userGoals.userId, session.user.id) }),
    db
      .select({
        calories: sql<number>`COALESCE(SUM(${meals.totalCalories}), 0)`,
        protein: sql<number>`COALESCE(SUM(${meals.totalProtein}), 0)`,
        carbs: sql<number>`COALESCE(SUM(${meals.totalCarbs}), 0)`,
        fat: sql<number>`COALESCE(SUM(${meals.totalFat}), 0)`
      })
      .from(meals)
      .where(sql`${meals.userId} = ${session.user.id} AND ${meals.date} = ${today}`)
  ])

  const g = goals ?? { calories: 2000, protein: 150, carbs: 250, fat: 70 }
  const c = consumed ?? { calories: 0, protein: 0, carbs: 0, fat: 0 }
  const remaining = {
    calories: Math.max(0, Math.round(g.calories - c.calories)),
    protein: Math.max(0, Math.round(g.protein - c.protein)),
    carbs: Math.max(0, Math.round(g.carbs - c.carbs)),
    fat: Math.max(0, Math.round(g.fat - c.fat))
  }

  const prompt = `You are a nutrition assistant. Suggest 3 concrete meal ideas based on these remaining daily nutrition goals:
- Calories: ${remaining.calories} kcal
- Protein: ${remaining.protein}g
- Carbs: ${remaining.carbs}g
- Fat: ${remaining.fat}g

Respond ONLY with valid JSON array, no markdown:
[{"name":"","description":"","calories":0,"protein":0,"carbs":0,"fat":0}]`

  const provider = await getAIProvider(session.user.id)
  const raw = await provider.generateText(prompt)
  const cleaned = raw.replace(/```json\n?/gi, '').replace(/```\n?/g, '').trim()
  const suggestions: RecipeSuggestion[] = JSON.parse(cleaned)

  return { suggestions, remaining }
})
