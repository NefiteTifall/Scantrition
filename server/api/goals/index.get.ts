import { db } from '../../db'
import { userGoals } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireUserSession(event)

  let goals = await db.query.userGoals.findFirst({
    where: eq(userGoals.userId, session.user.id)
  })

  if (!goals) {
    const [created] = await db
      .insert(userGoals)
      .values({ userId: session.user.id })
      .returning()
    goals = created
  }

  return goals
})
