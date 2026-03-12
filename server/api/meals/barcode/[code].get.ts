interface OFFNutriments {
  'energy-kcal_100g'?: number
  'energy-kcal'?: number
  'energy_100g'?: number
  'proteins_100g'?: number
  'carbohydrates_100g'?: number
  'fat_100g'?: number
  'fiber_100g'?: number
  'sugars_100g'?: number
  'saturated-fat_100g'?: number
  'salt_100g'?: number
  'sodium_100g'?: number
  // Extended fats
  'monounsaturated-fat_100g'?: number
  'polyunsaturated-fat_100g'?: number
  'trans-fat_100g'?: number
  'omega-3-fat_100g'?: number
  'omega-6-fat_100g'?: number
  'cholesterol_100g'?: number
  // Minerals
  'potassium_100g'?: number
  'calcium_100g'?: number
  'iron_100g'?: number
  'magnesium_100g'?: number
  'zinc_100g'?: number
  'phosphorus_100g'?: number
  'iodine_100g'?: number
  'selenium_100g'?: number
  // Vitamins
  'vitamin-a_100g'?: number
  'vitamin-c_100g'?: number
  'vitamin-d_100g'?: number
  'vitamin-e_100g'?: number
  'vitamin-b1_100g'?: number
  'vitamin-b2_100g'?: number
  'vitamin-pp_100g'?: number // B3/niacin
  'vitamin-b6_100g'?: number
  'vitamin-b9_100g'?: number
  'vitamin-b12_100g'?: number
  // Other
  'caffeine_100g'?: number
  'alcohol_100g'?: number
  // Niche fatty acids
  'butyric-acid_100g'?: number
  'caproic-acid_100g'?: number
  'caprylic-acid_100g'?: number
  'capric-acid_100g'?: number
  'lauric-acid_100g'?: number
  'myristic-acid_100g'?: number
  'palmitic-acid_100g'?: number
  'stearic-acid_100g'?: number
  'arachidic-acid_100g'?: number
  'oleic-acid_100g'?: number
  'erucic-acid_100g'?: number
  'alpha-linolenic-acid_100g'?: number
  'eicosapentaenoic-acid_100g'?: number
  'docosahexaenoic-acid_100g'?: number
  'arachidonic-acid_100g'?: number
  'gamma-linolenic-acid_100g'?: number
  // Sugars detail
  'sucrose_100g'?: number
  'glucose_100g'?: number
  'fructose_100g'?: number
  'lactose_100g'?: number
  'maltose_100g'?: number
  'maltodextrins_100g'?: number
  'starch_100g'?: number
  'polyols_100g'?: number
  // Amino acids / proteins detail
  'casein_100g'?: number
  'serum-proteins_100g'?: number
  'nucleotides_100g'?: number
  // Niche minerals
  'fluoride_100g'?: number
  'chromium_100g'?: number
  'molybdenum_100g'?: number
  'manganese_100g'?: number
  'copper_100g'?: number
  'bicarbonate_100g'?: number
  'chloride_100g'?: number
  'silica_100g'?: number
  [key: string]: number | undefined
}

interface OFFIngredient {
  text: string
  vegan?: string
  vegetarian?: string
  percent?: number
  percent_estimate?: number
}

interface OpenFoodFactsResponse {
  status: number
  product?: {
    product_name?: string
    product_name_fr?: string
    brands?: string
    image_url?: string
    serving_size?: string
    quantity?: string
    nutrition_grades?: string
    nutriscore_grade?: string
    nutriscore_score?: number
    origins?: string
    categories_fr?: string
    main_category_fr?: string
    nutriments?: OFFNutriments
    ingredients?: OFFIngredient[]
    labels_tags?: string[]
    additives_tags?: string[]
  }
}

function r1(v: number | undefined) {
  return v != null ? Math.round(v * 10) / 10 : undefined
}
function r2(v: number | undefined) {
  return v != null ? Math.round(v * 100) / 100 : undefined
}
function r4(v: number | undefined) {
  return v != null ? Math.round(v * 10000) / 10000 : undefined
}
function nonZero(v: number | undefined): number | undefined {
  return v != null && v > 0 ? v : undefined
}

function parseServingGrams(s: string | undefined): number | undefined {
  if (!s) return undefined
  const match = s.match(/(\d+(?:[.,]\d+)?)\s*(?:g|ml)/i)
  return match ? Math.round(parseFloat(match[1].replace(',', '.'))) : undefined
}

export default defineEventHandler(async (event) => {
  await requireSession(event)
  const code = getRouterParam(event, 'code')

  if (!code) {
    throw createError({ statusCode: 400, message: 'Barcode is required' })
  }

  const data = await $fetch<OpenFoodFactsResponse>(
    `https://world.openfoodfacts.org/api/v2/product/${code}?fields=product_name,product_name_fr,brands,image_url,serving_size,nutrition_grades,nutriscore_grade,nutriscore_score,nutriments,quantity,categories_fr,main_category_fr,labels_tags,origins,additives_tags,ingredients`
  )

  if (data.status !== 1 || !data.product) {
    throw createError({ statusCode: 404, message: 'Product not found' })
  }

  const product = data.product
  const n = product.nutriments ?? {}

  const kcal100g = n['energy-kcal_100g'] ?? (n['energy_100g'] ? Math.round(n['energy_100g'] / 4.184) : 0)
  const name = product.product_name_fr ?? product.product_name ?? 'Unknown product'

  const rawGrade = product.nutrition_grades ?? product.nutriscore_grade
  const nutriScore = rawGrade ? rawGrade.toUpperCase() as 'A' | 'B' | 'C' | 'D' | 'E' : undefined

  const servingSize = product.serving_size || undefined
  const servingGrams = parseServingGrams(servingSize)

  // Top-level ingredients only
  const ingredients = (product.ingredients ?? []).map((i: OFFIngredient) => ({
    text: i.text,
    vegan: i.vegan,
    vegetarian: i.vegetarian,
    percent: i.percent ?? (i.percent_estimate != null ? Math.round(i.percent_estimate * 10) / 10 : null)
  }))

  // Build niche JSONB objects (only non-zero values)
  const fattyAcids: Record<string, number> = {}
  const fattyAcidKeys: Array<[string, string]> = [
    ['butyric-acid_100g', 'butyric'], ['caproic-acid_100g', 'caproic'],
    ['caprylic-acid_100g', 'caprylic'], ['capric-acid_100g', 'capric'],
    ['lauric-acid_100g', 'lauric'], ['myristic-acid_100g', 'myristic'],
    ['palmitic-acid_100g', 'palmitic'], ['stearic-acid_100g', 'stearic'],
    ['arachidic-acid_100g', 'arachidic'], ['oleic-acid_100g', 'oleic'],
    ['erucic-acid_100g', 'erucic'], ['alpha-linolenic-acid_100g', 'alphaLinolenic'],
    ['eicosapentaenoic-acid_100g', 'epa'], ['docosahexaenoic-acid_100g', 'dha'],
    ['arachidonic-acid_100g', 'arachidonic'], ['gamma-linolenic-acid_100g', 'gammaLinolenic']
  ]
  for (const [offKey, label] of fattyAcidKeys) {
    const v = nonZero(n[offKey])
    if (v !== undefined) fattyAcids[label] = v
  }

  const sugarsDetail: Record<string, number> = {}
  const sugarsDetailKeys: Array<[string, string]> = [
    ['sucrose_100g', 'sucrose'], ['glucose_100g', 'glucose'],
    ['fructose_100g', 'fructose'], ['lactose_100g', 'lactose'],
    ['maltose_100g', 'maltose'], ['maltodextrins_100g', 'maltodextrins'],
    ['starch_100g', 'starch'], ['polyols_100g', 'polyols']
  ]
  for (const [offKey, label] of sugarsDetailKeys) {
    const v = nonZero(n[offKey])
    if (v !== undefined) sugarsDetail[label] = v
  }

  const aminoAcids: Record<string, number> = {}
  const aminoAcidKeys: Array<[string, string]> = [
    ['casein_100g', 'casein'], ['serum-proteins_100g', 'serumProteins'],
    ['nucleotides_100g', 'nucleotides']
  ]
  for (const [offKey, label] of aminoAcidKeys) {
    const v = nonZero(n[offKey])
    if (v !== undefined) aminoAcids[label] = v
  }

  const mineralsDetail: Record<string, number> = {}
  const mineralsDetailKeys: Array<[string, string]> = [
    ['fluoride_100g', 'fluoride'], ['chromium_100g', 'chromium'],
    ['molybdenum_100g', 'molybdenum'], ['manganese_100g', 'manganese'],
    ['copper_100g', 'copper'], ['bicarbonate_100g', 'bicarbonate'],
    ['chloride_100g', 'chloride'], ['silica_100g', 'silica']
  ]
  for (const [offKey, label] of mineralsDetailKeys) {
    const v = nonZero(n[offKey])
    if (v !== undefined) mineralsDetail[label] = v
  }

  return {
    items: [{
      name,
      quantity: servingSize ?? '100g',
      quantityGrams: servingGrams ?? 100,
      calories: Math.round(kcal100g),
      protein: r1(n['proteins_100g']) ?? 0,
      carbs: r1(n['carbohydrates_100g']) ?? 0,
      fat: r1(n['fat_100g']) ?? 0,
      fiber: r1(n['fiber_100g']),
      sugar: r1(n['sugars_100g']),
      saturatedFat: r1(n['saturated-fat_100g']),
      salt: r2(n['salt_100g'])
    }],
    totalCalories: Math.round(kcal100g),
    totalProtein: r1(n['proteins_100g']) ?? 0,
    totalCarbs: r1(n['carbohydrates_100g']) ?? 0,
    totalFat: r1(n['fat_100g']) ?? 0,
    totalFiber: r1(n['fiber_100g']),
    totalSugar: r1(n['sugars_100g']),
    totalSaturatedFat: r1(n['saturated-fat_100g']),
    totalSalt: r2(n['salt_100g']),
    // Extended fats
    totalMonounsaturatedFat: r1(n['monounsaturated-fat_100g']),
    totalPolyunsaturatedFat: r1(n['polyunsaturated-fat_100g']),
    totalTransFat: r1(n['trans-fat_100g']),
    totalOmega3Fat: r1(n['omega-3-fat_100g']),
    totalOmega6Fat: r1(n['omega-6-fat_100g']),
    totalCholesterol: r1(n['cholesterol_100g']),
    // Minerals
    totalSodium: r4(n['sodium_100g']),
    totalPotassium: r1(n['potassium_100g']),
    totalCalcium: r1(n['calcium_100g']),
    totalIron: r4(n['iron_100g']),
    totalMagnesium: r1(n['magnesium_100g']),
    totalZinc: r4(n['zinc_100g']),
    totalPhosphorus: r1(n['phosphorus_100g']),
    totalIodine: r4(n['iodine_100g']),
    totalSelenium: r4(n['selenium_100g']),
    // Vitamins
    totalVitaminA: r4(n['vitamin-a_100g']),
    totalVitaminC: r1(n['vitamin-c_100g']),
    totalVitaminD: r4(n['vitamin-d_100g']),
    totalVitaminE: r1(n['vitamin-e_100g']),
    totalVitaminB1: r4(n['vitamin-b1_100g']),
    totalVitaminB2: r4(n['vitamin-b2_100g']),
    totalVitaminB3: r1(n['vitamin-pp_100g']),
    totalVitaminB6: r4(n['vitamin-b6_100g']),
    totalVitaminB9: r4(n['vitamin-b9_100g']),
    totalVitaminB12: r4(n['vitamin-b12_100g']),
    // Other
    totalCaffeine: r1(n['caffeine_100g']),
    totalAlcohol: r1(n['alcohol_100g']),
    // Niche JSONB
    fattyAcids: Object.keys(fattyAcids).length > 0 ? fattyAcids : undefined,
    sugarsDetail: Object.keys(sugarsDetail).length > 0 ? sugarsDetail : undefined,
    aminoAcids: Object.keys(aminoAcids).length > 0 ? aminoAcids : undefined,
    mineralsDetail: Object.keys(mineralsDetail).length > 0 ? mineralsDetail : undefined,
    // Scores & metadata
    nutriScore,
    novaGroup: n['nova-group_100g'] != null ? Math.round(n['nova-group_100g']) : undefined,
    nutriscoreScore: product.nutriscore_score,
    confidence: 1,
    productName: name,
    brand: product.brands,
    image: product.image_url,
    barcode: code,
    servingSize,
    servingGrams,
    origins: product.origins || undefined,
    quantity: product.quantity || undefined,
    categoriesFr: product.categories_fr ?? product.main_category_fr ?? undefined,
    ingredients: ingredients.length > 0 ? ingredients : undefined,
    labelsTags: product.labels_tags?.length ? product.labels_tags : undefined,
    additivesTags: product.additives_tags?.length ? product.additives_tags : undefined
  }
})
