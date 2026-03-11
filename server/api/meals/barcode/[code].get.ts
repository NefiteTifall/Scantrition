interface OpenFoodFactsResponse {
  status: number
  product?: {
    product_name?: string
    product_name_fr?: string
    brands?: string
    image_url?: string
    nutriments?: {
      'energy-kcal_100g'?: number
      'energy-kcal'?: number
      'energy_100g'?: number
      'proteins_100g'?: number
      'carbohydrates_100g'?: number
      'fat_100g'?: number
      'fiber_100g'?: number
    }
    serving_size?: string
  }
}

export default defineEventHandler(async (event) => {
  await requireSession(event)
  const code = getRouterParam(event, 'code')

  if (!code) {
    throw createError({ statusCode: 400, message: 'Barcode is required' })
  }

  const data = await $fetch<OpenFoodFactsResponse>(
    `https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_fr,brands,nutriments,image_url,serving_size`
  )

  if (data.status !== 1 || !data.product) {
    throw createError({ statusCode: 404, message: 'Product not found' })
  }

  const product = data.product
  const n = product.nutriments ?? {}

  const kcal100g = n['energy-kcal_100g'] ?? (n.energy_100g ? Math.round(n.energy_100g / 4.184) : 0)
  const name = product.product_name_fr ?? product.product_name ?? 'Unknown product'

  return {
    items: [{
      name,
      quantity: '100g',
      calories: Math.round(kcal100g),
      protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
      carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
      fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
      fiber: Math.round((n.fiber_100g ?? 0) * 10) / 10
    }],
    totalCalories: Math.round(kcal100g),
    totalProtein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
    totalCarbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
    totalFat: Math.round((n.fat_100g ?? 0) * 10) / 10,
    confidence: 1,
    source: name,
    productName: name,
    brand: product.brands,
    image: product.image_url
  }
})
