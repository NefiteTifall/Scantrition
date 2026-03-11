import { db } from '../../db'
import { userGoals } from '../../db/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { description } = await readBody(event)

  if (!description?.trim()) {
    throw createError({ statusCode: 400, message: 'Description is required' })
  }

  const goals = await db.query.userGoals.findFirst({ where: eq(userGoals.userId, session.user.id) })
  const healthGoal = goals?.healthGoal ?? 'balance'

  const provider = await getAIProvider(session.user.id)
  try {
    return await provider.analyzeText(description, healthGoal)
  } catch (err: unknown) {
    throw createError({ statusCode: 500, message: extractProviderError(err, provider.providerName) })
  }
})
