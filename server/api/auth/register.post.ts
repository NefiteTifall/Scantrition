import { db } from '../../db'
import { users, userGoals } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit, getClientIp } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  checkRateLimit(`register:${getClientIp(event)}`, 5, 60 * 60 * 1000)

  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password are required' })
  }
  if (password.length < 8) {
    throw createError({ statusCode: 400, message: 'Password must be at least 8 characters' })
  }

  const existing = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim())
  })

  if (existing) {
    throw createError({ statusCode: 409, message: 'Email already in use' })
  }

  const passwordHash = await hashPassword(password)
  const [user] = await db
    .insert(users)
    .values({ email: email.toLowerCase().trim(), passwordHash })
    .returning()

  if (!user) throw createError({ statusCode: 500, message: 'Registration failed' })

  await db.insert(userGoals).values({ userId: user.id })

  await setUserSession(event, { user: { id: user.id, email: user.email } })

  return { user: { id: user.id, email: user.email } }
})
