import { db } from '../../db'
import { products } from '../../db/schema'
import { upsertProduct } from '../../utils/products'
import { and, eq } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const session = await requireSession(event)
  const body = await readBody(event)

  const productId = await upsertProduct({
    userId: session.user.id,
    name: body.name,
    barcode: body.barcode ?? null,
    brand: body.brand ?? null,
    image: body.image ?? null,
    source: body.barcode ? 'barcode' : 'search',
    servingSize: body.servingSize ?? null,
    calories: body.calories,
    protein: body.protein,
    carbs: body.carbs,
    fat: body.fat,
    fiber: body.fiber ?? null,
    sugar: body.sugar ?? null,
    saturatedFat: body.saturatedFat ?? null,
    salt: body.salt ?? null,
    monounsaturatedFat: body.monounsaturatedFat ?? null,
    polyunsaturatedFat: body.polyunsaturatedFat ?? null,
    transFat: body.transFat ?? null,
    omega3Fat: body.omega3Fat ?? null,
    omega6Fat: body.omega6Fat ?? null,
    cholesterol: body.cholesterol ?? null,
    sodium: body.sodium ?? null,
    potassium: body.potassium ?? null,
    calcium: body.calcium ?? null,
    iron: body.iron ?? null,
    magnesium: body.magnesium ?? null,
    zinc: body.zinc ?? null,
    phosphorus: body.phosphorus ?? null,
    iodine: body.iodine ?? null,
    selenium: body.selenium ?? null,
    vitaminA: body.vitaminA ?? null,
    vitaminC: body.vitaminC ?? null,
    vitaminD: body.vitaminD ?? null,
    vitaminE: body.vitaminE ?? null,
    vitaminB1: body.vitaminB1 ?? null,
    vitaminB2: body.vitaminB2 ?? null,
    vitaminB3: body.vitaminB3 ?? null,
    vitaminB6: body.vitaminB6 ?? null,
    vitaminB9: body.vitaminB9 ?? null,
    vitaminB12: body.vitaminB12 ?? null,
    caffeine: body.caffeine ?? null,
    alcohol: body.alcohol ?? null,
    nutriScore: body.nutriScore ?? null,
    novaGroup: body.novaGroup ?? null,
    nutriscoreScore: body.nutriscoreScore ?? null,
    origins: body.origins ?? null,
    quantity: body.quantity ?? null,
    categoriesFr: body.categoriesFr ?? null,
    ingredients: body.ingredients ?? null,
    labelsTags: body.labelsTags ?? null,
    additivesTags: body.additivesTags ?? null,
    fattyAcids: body.fattyAcids ?? null,
    sugarsDetail: body.sugarsDetail ?? null,
    aminoAcids: body.aminoAcids ?? null,
    mineralsDetail: body.mineralsDetail ?? null
  })

  const [product] = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, session.user.id)))
    .limit(1)

  return product
})
