import { GoogleGenerativeAI } from '@google/generative-ai'
import { db } from '../db'
import { aiSettings } from '../db/schema'
import { eq } from 'drizzle-orm'

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

export interface AIProvider {
  providerName: string
  analyzeText(description: string): Promise<NutritionResult>
  analyzeImage(imageBase64: string, mimeType: string): Promise<NutritionResult>
  generateText(prompt: string): Promise<string>
}

export function extractProviderError(err: unknown, provider: string): string {
  if (!(err instanceof Error)) return `Erreur ${provider} inconnue`

  const data = (err as { data?: unknown }).data as Record<string, unknown> | undefined
  const statusCode = (err as { statusCode?: number; status?: number }).statusCode
    ?? (err as { statusCode?: number; status?: number }).status
    ?? 0

  let bodyMsg = ''
  if (data) {
    const errorObj = data.error as Record<string, unknown> | string | undefined
    if (typeof errorObj === 'string') bodyMsg = errorObj
    else if (errorObj && typeof errorObj === 'object') bodyMsg = String(errorObj.message ?? '')
    if (!bodyMsg) bodyMsg = String(data.message ?? '')
  }

  const combined = bodyMsg || err.message
  const lower = combined.toLowerCase()

  if (statusCode === 401 || lower.includes('api key') || lower.includes('unauthorized')
    || lower.includes('unauthenticated') || lower.includes('invalid_api_key')
    || lower.includes('authentication_error') || lower.includes('no key')) {
    return `Clé API ${provider} invalide ou expirée`
  }
  if (statusCode === 429 || lower.includes('quota') || lower.includes('rate limit')
    || lower.includes('too many requests') || lower.includes('resource_exhausted')) {
    return `Quota ${provider} dépassé — réessayez dans quelques instants`
  }
  if (lower.includes('model') && (lower.includes('not found') || lower.includes('does not exist'))) {
    return `Modèle introuvable chez ${provider} — vérifiez votre configuration`
  }
  if (lower.includes('econnrefused') || lower.includes('fetch failed') || lower.includes('enotfound')) {
    return `Impossible de contacter ${provider} — vérifiez l'URL et votre connexion`
  }

  return bodyMsg || err.message || `Erreur ${provider}`
}

export const TEXT_PROMPT = (description: string) => `You are a nutrition analysis assistant. The user describes what they ate. Parse the description and return estimated nutritional values.

User description: "${description}"

Rules:
- Infer standard portion sizes if not specified
- Use common French/European food database values
- If the description is ambiguous, make reasonable assumptions and lower confidence
- Return values in grams for macros, kcal for calories

Respond ONLY with valid JSON, no markdown, no explanation:
{"items":[{"name":"","quantity":"","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0}],"totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"confidence":0.75}`

export const PHOTO_PROMPT = `You are a nutrition analysis assistant. Analyze the food in this image and return a JSON response with the estimated nutritional breakdown.

Rules:
- Estimate portions based on visual cues (plate size, utensils, etc.)
- If unsure about a food item, make your best estimate and lower the confidence score
- All values are per serving as shown in the image
- Return values in grams for macros, kcal for calories

Respond ONLY with valid JSON, no markdown, no explanation:
{"items":[{"name":"","quantity":"","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0}],"totalCalories":0,"totalProtein":0,"totalCarbs":0,"totalFat":0,"confidence":0.85}`

export function parseNutritionJSON(text: string): NutritionResult {
  const cleaned = text
    .replace(/```json\n?/gi, '')
    .replace(/```\n?/g, '')
    .trim()
  const result = JSON.parse(cleaned)
  if (!result.items || !Array.isArray(result.items)) {
    throw new Error('Invalid AI response: missing items array')
  }
  return result
}

class GeminiProvider implements AIProvider {
  providerName = 'Gemini'
  private genAI: GoogleGenerativeAI
  constructor(private apiKey: string, private model = 'gemini-2.0-flash') {
    this.genAI = new GoogleGenerativeAI(apiKey)
  }

  async analyzeText(description: string): Promise<NutritionResult> {
    const model = this.genAI.getGenerativeModel({ model: this.model })
    const result = await model.generateContent(TEXT_PROMPT(description))
    return parseNutritionJSON(result.response.text())
  }

  async analyzeImage(imageBase64: string, mimeType: string): Promise<NutritionResult> {
    const model = this.genAI.getGenerativeModel({ model: this.model })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result = await model.generateContent([
      { inlineData: { mimeType: mimeType as any, data: imageBase64 } },
      { text: PHOTO_PROMPT }
    ])
    return parseNutritionJSON(result.response.text())
  }

  async generateText(prompt: string): Promise<string> {
    const model = this.genAI.getGenerativeModel({ model: this.model })
    const result = await model.generateContent(prompt)
    return result.response.text()
  }
}

class OpenAIProvider implements AIProvider {
  providerName = 'OpenAI'
  constructor(private apiKey: string, private model = 'gpt-4o') {}

  async analyzeText(description: string): Promise<NutritionResult> {
    const res = await $fetch<{ choices: Array<{ message: { content: string } }> }>(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: {
          model: this.model,
          messages: [{ role: 'user', content: TEXT_PROMPT(description) }],
          max_tokens: 1024
        }
      }
    )
    return parseNutritionJSON(res.choices[0].message.content)
  }

  async analyzeImage(imageBase64: string, mimeType: string): Promise<NutritionResult> {
    const res = await $fetch<{ choices: Array<{ message: { content: string } }> }>(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: {
          model: this.model,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: 'text', text: PHOTO_PROMPT }
            ]
          }],
          max_tokens: 1024
        }
      }
    )
    return parseNutritionJSON(res.choices[0].message.content)
  }

  async generateText(prompt: string): Promise<string> {
    const res = await $fetch<{ choices: Array<{ message: { content: string } }> }>(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: { model: this.model, messages: [{ role: 'user', content: prompt }], max_tokens: 1024 }
      }
    )
    return res.choices[0].message.content
  }
}

class AnthropicProvider implements AIProvider {
  providerName = 'Anthropic'
  constructor(private apiKey: string, private model = 'claude-sonnet-4-6') {}

  async analyzeText(description: string): Promise<NutritionResult> {
    const res = await $fetch<{ content: Array<{ text: string }> }>(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: {
          model: this.model,
          max_tokens: 1024,
          messages: [{ role: 'user', content: TEXT_PROMPT(description) }]
        }
      }
    )
    return parseNutritionJSON(res.content[0].text)
  }

  async analyzeImage(imageBase64: string, mimeType: string): Promise<NutritionResult> {
    const res = await $fetch<{ content: Array<{ text: string }> }>(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: {
          model: this.model,
          max_tokens: 1024,
          messages: [{
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageBase64 } },
              { type: 'text', text: PHOTO_PROMPT }
            ]
          }]
        }
      }
    )
    return parseNutritionJSON(res.content[0].text)
  }

  async generateText(prompt: string): Promise<string> {
    const res = await $fetch<{ content: Array<{ text: string }> }>(
      'https://api.anthropic.com/v1/messages',
      {
        method: 'POST',
        headers: { 'x-api-key': this.apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
        body: { model: this.model, max_tokens: 1024, messages: [{ role: 'user', content: prompt }] }
      }
    )
    return res.content[0].text
  }
}

class OpenRouterProvider implements AIProvider {
  providerName = 'OpenRouter'
  constructor(private apiKey: string, private model = 'google/gemini-2.0-flash-001') {}

  async analyzeText(description: string): Promise<NutritionResult> {
    const res = await $fetch<{ choices: Array<{ message: { content: string } }> }>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: {
          model: this.model,
          messages: [{ role: 'user', content: TEXT_PROMPT(description) }]
        }
      }
    )
    return parseNutritionJSON(res.choices[0].message.content)
  }

  async analyzeImage(imageBase64: string, mimeType: string): Promise<NutritionResult> {
    const res = await $fetch<{ choices: Array<{ message: { content: string } }> }>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: {
          model: this.model,
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
              { type: 'text', text: PHOTO_PROMPT }
            ]
          }]
        }
      }
    )
    return parseNutritionJSON(res.choices[0].message.content)
  }

  async generateText(prompt: string): Promise<string> {
    const res = await $fetch<{ choices: Array<{ message: { content: string } }> }>(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        body: { model: this.model, messages: [{ role: 'user', content: prompt }] }
      }
    )
    return res.choices[0].message.content
  }
}

export async function getAIProvider(userId: string): Promise<AIProvider> {
  const settings = await db.query.aiSettings.findFirst({
    where: eq(aiSettings.userId, userId)
  })

  const provider = settings?.provider ?? 'gemini'
  const userKey = settings?.apiKey ?? ''
  const model = settings?.model ?? undefined

  switch (provider) {
    case 'openai':
      return new OpenAIProvider(userKey || process.env.OPENAI_API_KEY || '', model ?? 'gpt-4o')
    case 'anthropic':
      return new AnthropicProvider(userKey || process.env.ANTHROPIC_API_KEY || '', model ?? 'claude-sonnet-4-6')
    case 'openrouter':
      return new OpenRouterProvider(userKey || process.env.OPENROUTER_API_KEY || '', model ?? 'google/gemini-2.0-flash-001')
    case 'gemini':
    default:
      return new GeminiProvider(userKey || process.env.GEMINI_API_KEY || '', model ?? 'gemini-2.0-flash')
  }
}
