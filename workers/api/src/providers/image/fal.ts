import type { GenerationProvider, ImageOptions, GenerationResult } from '../interface'

export class FALAdapter implements GenerationProvider {
  name = 'fal'

  generateImage(_prompt: string, _options: ImageOptions): Promise<GenerationResult> {
    throw new Error('FAL adapter not active in V1')
  }

  generatePortrait(_prompt: string, _aspectRatio: string): Promise<GenerationResult> {
    throw new Error('FAL adapter not active in V1')
  }

  editPortrait(_imageUrl: string, _editPrompt: string, _aspectRatio: string): Promise<GenerationResult> {
    throw new Error('FAL adapter not active in V1')
  }
}
