import { db } from '../../db'
import { users } from '../../db/schema'
import { eq } from 'drizzle-orm'
import { checkRateLimit, getClientIp } from '../../utils/rateLimit'

export default defineEventHandler(async (event) => {
  checkRateLimit(`login:${getClientIp(event)}`, 10, 15 * 60 * 1000)

  const { email, password } = await readBody(event)

  if (!email || !password) {
    throw createError({ statusCode: 400, message: 'Email and password are required' })
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.toLowerCase().trim())
  })

  if (!user || !await verifyPassword(user.passwordHash, password)) {
    throw createError({ statusCode: 401, message: 'Invalid credentials' })
  }

  await setUserSession(event, { user: { id: user.id, email: user.email } })

  return { user: { id: user.id, email: user.email } }
})
