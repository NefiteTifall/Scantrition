import { db } from '../../db'
import { userFavoriteProducts, products } from '../../db/schema'
import { eq, desc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)

  const rows = await db
    .select()
    .from(userFavoriteProducts)
    .innerJoin(products, eq(userFavoriteProducts.productId, products.id))
    .where(eq(userFavoriteProducts.userId, session.user.id))
    .orderBy(desc(userFavoriteProducts.createdAt))

  return rows.map(row => ({
    id: row.user_favorite_products.id,
    name: row.user_favorite_products.name,
    productId: row.user_favorite_products.productId,
    product: row.products,
    createdAt: row.user_favorite_products.createdAt
  }))
})
