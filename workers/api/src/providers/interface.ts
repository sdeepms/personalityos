export interface GenerationProvider {
  name: string
  generateImage(prompt: string, options: ImageOptions): Promise<GenerationResult>
}

export interface ImageOptions {
  referenceImageUrls?: string[]
  aspectRatio: string
  negativePrompt?: string
  model?: string
  userId?: string
  characterId?: string
}

export interface GenerationResult {
  outputUrl: string
  provider: string
  model: string
  durationMs: number
  costUsdCents: number
}
