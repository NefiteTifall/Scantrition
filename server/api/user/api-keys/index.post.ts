import { db } from '../../../db'
import { userApiKeys } from '../../../db/schema'
import { generateApiKey, hashApiKey } from '../../../utils/apiAuth'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { name } = await readBody(event)

  if (!name?.trim()) throw createError({ statusCode: 400, message: 'Name is required' })

  const rawKey = generateApiKey()
  const keyHash = await hashApiKey(rawKey)
  const prefix = rawKey.slice(0, 12)

  await db.insert(userApiKeys).values({
    userId: session.user.id,
    name: name.trim(),
    keyHash,
    prefix
  })

  // Return the raw key ONLY once — it won't be stored
  return { key: rawKey, prefix, name: name.trim() }
})
