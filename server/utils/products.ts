import { db } from '../db'
import { products } from '../db/schema'
import { and, eq } from 'drizzle-orm'

function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export interface UpsertProductInput {
  userId: string
  name: string
  barcode?: string | null
  brand?: string | null
  image?: string | null
  source: 'barcode' | 'search' | 'ai' | 'photo' | 'recipe'
  servingSize?: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number | null
  sugar?: number | null
  saturatedFat?: number | null
  salt?: number | null
  // Extended fats
  monounsaturatedFat?: number | null
  polyunsaturatedFat?: number | null
  transFat?: number | null
  omega3Fat?: number | null
  omega6Fat?: number | null
  cholesterol?: number | null
  // Minerals
  sodium?: number | null
  potassium?: number | null
  calcium?: number | null
  iron?: number | null
  magnesium?: number | null
  zinc?: number | null
  phosphorus?: number | null
  iodine?: number | null
  selenium?: number | null
  // Vitamins
  vitaminA?: number | null
  vitaminC?: number | null
  vitaminD?: number | null
  vitaminE?: number | null
  vitaminB1?: number | null
  vitaminB2?: number | null
  vitaminB3?: number | null
  vitaminB6?: number | null
  vitaminB9?: number | null
  vitaminB12?: number | null
  // Other
  caffeine?: number | null
  alcohol?: number | null
  // Scores & metadata
  nutriScore?: string | null
  novaGroup?: number | null
  nutriscoreScore?: number | null
  origins?: string | null
  quantity?: string | null
  categoriesFr?: string | null
  ingredients?: Array<{ text: string, vegan?: string, vegetarian?: string, percent?: number | null }> | null
  labelsTags?: string[] | null
  additivesTags?: string[] | null
  fattyAcids?: Record<string, number> | null
  sugarsDetail?: Record<string, number> | null
  aminoAcids?: Record<string, number> | null
  mineralsDetail?: Record<string, number> | null
}

export async function upsertProduct(input: UpsertProductInput): Promise<string> {
  const slug = slugify(input.name)

  const values = {
    userId: input.userId,
    name: input.name,
    slug,
    barcode: input.barcode ?? null,
    brand: input.brand ?? null,
    image: input.image ?? null,
    source: input.source,
    servingSize: input.servingSize ?? null,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    fiber: input.fiber ?? null,
    sugar: input.sugar ?? null,
    saturatedFat: input.saturatedFat ?? null,
    salt: input.salt ?? null,
    monounsaturatedFat: input.monounsaturatedFat ?? null,
    polyunsaturatedFat: input.polyunsaturatedFat ?? null,
    transFat: input.transFat ?? null,
    omega3Fat: input.omega3Fat ?? null,
    omega6Fat: input.omega6Fat ?? null,
    cholesterol: input.cholesterol ?? null,
    sodium: input.sodium ?? null,
    potassium: input.potassium ?? null,
    calcium: input.calcium ?? null,
    iron: input.iron ?? null,
    magnesium: input.magnesium ?? null,
    zinc: input.zinc ?? null,
    phosphorus: input.phosphorus ?? null,
    iodine: input.iodine ?? null,
    selenium: input.selenium ?? null,
    vitaminA: input.vitaminA ?? null,
    vitaminC: input.vitaminC ?? null,
    vitaminD: input.vitaminD ?? null,
    vitaminE: input.vitaminE ?? null,
    vitaminB1: input.vitaminB1 ?? null,
    vitaminB2: input.vitaminB2 ?? null,
    vitaminB3: input.vitaminB3 ?? null,
    vitaminB6: input.vitaminB6 ?? null,
    vitaminB9: input.vitaminB9 ?? null,
    vitaminB12: input.vitaminB12 ?? null,
    caffeine: input.caffeine ?? null,
    alcohol: input.alcohol ?? null,
    nutriScore: (input.nutriScore as 'A' | 'B' | 'C' | 'D' | 'E' | null) ?? null,
    novaGroup: input.novaGroup ?? null,
    nutriscoreScore: input.nutriscoreScore ?? null,
    origins: input.origins ?? null,
    quantity: input.quantity ?? null,
    categoriesFr: input.categoriesFr ?? null,
    ingredients: input.ingredients ?? null,
    labelsTags: input.labelsTags ?? null,
    additivesTags: input.additivesTags ?? null,
    fattyAcids: input.fattyAcids ?? null,
    sugarsDetail: input.sugarsDetail ?? null,
    aminoAcids: input.aminoAcids ?? null,
    mineralsDetail: input.mineralsDetail ?? null
  }

  // Barcode: update existing product with latest OFF data
  if (input.barcode && input.source === 'barcode') {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.userId, input.userId), eq(products.barcode, input.barcode)))
      .limit(1)

    if (existing[0]) {
      await db.update(products).set(values).where(eq(products.id, existing[0].id))
      return existing[0].id
    }
  }

  // Search: reuse existing product with same slug
  if (input.source === 'search') {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.userId, input.userId), eq(products.slug, slug), eq(products.source, 'search')))
      .limit(1)
    if (existing[0]) return existing[0].id
  }

  // AI/Photo/Recipe: always create new
  const [product] = await db
    .insert(products)
    .values(values)
    .returning({ id: products.id })

  return product.id
}
