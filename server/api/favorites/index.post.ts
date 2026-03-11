import { db } from '../../db'
import { userFavoriteProducts } from '../../db/schema'
import { upsertProduct } from '../../utils/products'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readBody(event)

  if (!body.name?.trim()) throw createError({ statusCode: 400, message: 'Name is required' })

  // If productId already known, use it directly
  let productId: string = body.productId

  // Otherwise, create/find the product from provided nutritional data
  if (!productId) {
    if (body.calories == null || body.protein == null) {
      throw createError({ statusCode: 400, message: 'productId or nutritional data required' })
    }
    const source = body.barcode ? 'barcode' : body.productName ? 'search' : 'ai'
    productId = await upsertProduct({
      userId: session.user.id,
      name: body.productName ?? body.name,
      barcode: body.barcode ?? null,
      brand: body.brand ?? null,
      image: body.image ?? null,
      source,
      servingSize: body.servingSize ?? null,
      calories: body.calories,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
      fiber: body.fiber ?? null,
      sugar: body.sugar ?? null,
      saturatedFat: body.saturatedFat ?? null,
      salt: body.salt ?? null,
      nutriScore: body.nutriScore ?? null
    })
  }

  const [fav] = await db.insert(userFavoriteProducts).values({
    userId: session.user.id,
    productId,
    name: body.name.trim()
  }).returning()

  return fav
})
