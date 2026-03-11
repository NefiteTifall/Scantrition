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

interface UpsertProductInput {
  userId: string
  name: string
  barcode?: string | null
  brand?: string | null
  image?: string | null
  source: 'barcode' | 'search' | 'ai' | 'photo'
  servingSize?: string | null
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number | null
  sugar?: number | null
  saturatedFat?: number | null
  salt?: number | null
  nutriScore?: string | null
}

export async function upsertProduct(input: UpsertProductInput): Promise<string> {
  const slug = slugify(input.name)

  // Barcode: reuse existing product with same barcode
  if (input.barcode && input.source === 'barcode') {
    const existing = await db
      .select({ id: products.id })
      .from(products)
      .where(and(eq(products.userId, input.userId), eq(products.barcode, input.barcode)))
      .limit(1)
    if (existing[0]) return existing[0].id
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

  // AI/Photo: always create new
  const [product] = await db
    .insert(products)
    .values({
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
      nutriScore: (input.nutriScore as 'A' | 'B' | 'C' | 'D' | 'E' | null) ?? null
    })
    .returning({ id: products.id })

  return product.id
}
