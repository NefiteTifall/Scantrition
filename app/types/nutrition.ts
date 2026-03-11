export interface MealItem {
  name: string
  quantity: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber?: number
}

export interface NutritionResult {
  items: MealItem[]
  totalCalories: number
  totalProtein: number
  totalCarbs: number
  totalFat: number
  confidence: number
}
