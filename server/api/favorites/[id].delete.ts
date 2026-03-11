import { db } from '../../db'
import { userFavoriteProducts } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id')!

  await db.delete(userFavoriteProducts).where(
    and(eq(userFavoriteProducts.id, id), eq(userFavoriteProducts.userId, session.user.id))
  )

  return { ok: true }
})
