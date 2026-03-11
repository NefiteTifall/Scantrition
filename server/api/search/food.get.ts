interface OFFSearchResponse {
  count: number
  products: Array<{
    code?: string
    product_name?: string
    product_name_fr?: string
    brands?: string
    image_url?: string
    nutriments?: {
      'energy-kcal_100g'?: number
      energy_100g?: number
      proteins_100g?: number
      carbohydrates_100g?: number
      fat_100g?: number
      fiber_100g?: number
    }
  }>
}

export default defineEventHandler(async (event) => {
  await requireUserSession(event)
  const { q } = getQuery(event)

  if (!q || typeof q !== 'string' || q.trim().length < 2) {
    throw createError({ statusCode: 400, message: 'Query too short' })
  }

  const data = await $fetch<OFFSearchResponse>(
    'https://world.openfoodfacts.org/cgi/search.pl',
    {
      query: {
        search_terms: q,
        json: 1,
        page_size: 15,
        fields: 'code,product_name,product_name_fr,brands,nutriments,image_url'
      }
    }
  )

  return data.products
    .filter(p => p.nutriments?.['energy-kcal_100g'] || p.nutriments?.energy_100g)
    .map(p => {
      const n = p.nutriments ?? {}
      const kcal = n['energy-kcal_100g'] ?? (n.energy_100g ? Math.round(n.energy_100g / 4.184) : 0)
      const name = p.product_name_fr ?? p.product_name ?? 'Unknown'
      return {
        code: p.code,
        name,
        brand: p.brands ?? null,
        image: p.image_url ?? null,
        per100g: {
          calories: Math.round(kcal),
          protein: Math.round((n.proteins_100g ?? 0) * 10) / 10,
          carbs: Math.round((n.carbohydrates_100g ?? 0) * 10) / 10,
          fat: Math.round((n.fat_100g ?? 0) * 10) / 10,
          fiber: Math.round((n.fiber_100g ?? 0) * 10) / 10
        }
      }
    })
})
