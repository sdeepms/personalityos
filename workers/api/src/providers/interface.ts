export interface GenerationProvider {
  name: string
  generateImage(prompt: string, options: ImageOptions): Promise<GenerationResult>
}

export interface ImageOptions {
  referenceImageUrl?: string
  aspectRatio: string
  negativePrompt?: string
  model?: string
  userId?: string
  characterId?: string
}

export interface GenerationResult {
  outputUrl: string
  imageBase64?: string
  provider: string
  model: string
  durationMs: number
  costUsdCents: number
}
