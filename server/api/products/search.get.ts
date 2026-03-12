import { db } from '../../db'
import { products } from '../../db/schema'
import { and, eq, ilike, or } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const { q } = getQuery(event) as { q?: string }

  if (!q || q.trim().length < 2) return []

  const term = `%${q.trim()}%`

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      brand: products.brand,
      image: products.image,
      calories: products.calories,
      protein: products.protein,
      carbs: products.carbs,
      fat: products.fat,
      servingSize: products.servingSize
    })
    .from(products)
    .where(and(
      eq(products.userId, session.user.id),
      or(
        ilike(products.name, term),
        ilike(products.brand, term)
      )
    ))
    .limit(20)

  return rows
})
