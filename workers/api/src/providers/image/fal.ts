import type { GenerationProvider, ImageOptions, GenerationResult } from '../interface'

export class FALAdapter implements GenerationProvider {
  name = 'fal'

  generateImage(_prompt: string, _options: ImageOptions): Promise<GenerationResult> {
    throw new Error('FAL adapter not active in V1')
  }
}
