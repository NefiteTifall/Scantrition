export interface MealItem {
  productId?: string
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
  sugar?: number
  saturatedFat?: number
  salt?: number
}

export interface NutritionResult {
  items: MealItem[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  totalFiber?: number
  totalSugar?: number
  totalSaturatedFat?: number
  totalSalt?: number
  nutriScore?: 'A' | 'B' | 'C' | 'D' | 'E'
  healthScore?: number
  healthLabel?: 'excellent' | 'good' | 'limit' | 'avoid'
  confidence: number
  productName?: string
  brand?: string
  image?: string
  barcode?: string
}
