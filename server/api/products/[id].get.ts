import { db } from '../../db'
import { products } from '../../db/schema'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const id = getRouterParam(event, 'id')!

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, id), eq(products.userId, session.user.id)))
    .limit(1)

  if (!product) throw createError({ statusCode: 404, message: 'Product not found' })

  return product
})
