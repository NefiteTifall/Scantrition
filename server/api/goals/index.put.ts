import { db } from '../../db'
import { userGoals } from '../../db/schema'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { calories, protein, carbs, fat, fiber, healthGoal } = await readBody(event)

  const [result] = await db
    .insert(userGoals)
    .values({ userId: session.user.id, calories, protein, carbs, fat, ...(fiber != null ? { fiber } : {}), ...(healthGoal ? { healthGoal } : {}) })
    .onConflictDoUpdate({
      target: userGoals.userId,
      set: { calories, protein, carbs, fat, ...(fiber != null ? { fiber } : {}), ...(healthGoal ? { healthGoal } : {}), updatedAt: new Date() }
    })
    .returning()

  return result
})
