export type Model = {
  id: string
  name: string
  endpoint: string
  defaultSteps: number
  defaultWidth: number
  defaultHeight: number
}

export const MODELS: Model[] = [
  {
    id: 'flux-dev',
    name: 'Flux Dev',
    endpoint: '/api/v1/flux-dev',
    defaultSteps: 28,
    defaultWidth: 1024,
    defaultHeight: 1024,
  },
  {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    endpoint: '/api/v1/flux-schnell',
    defaultSteps: 4,
    defaultWidth: 1024,
    defaultHeight: 1024,
  },
]

export function getModelById(id: string): Model | undefined {
  return MODELS.find((m) => m.id === id)
}

export function getDefaultModel(): Model {
  return MODELS.find((m) => m.id === 'flux-dev')!
}
