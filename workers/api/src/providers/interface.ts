export interface GenerationProvider {
  name: string
  generateImage(prompt: string, options: ImageOptions): Promise<GenerationResult>
  generatePortrait(prompt: string, aspectRatio: string): Promise<GenerationResult>
  editPortrait(imageUrl: string, editPrompt: string, aspectRatio: string): Promise<GenerationResult>
  generateProductPhotography(
    personImageUrl: string,
    productImageUrl: string,
    prompt: string,
    aspectRatio: string
  ): Promise<GenerationResult>
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
