import type { Env } from '../index'
import type { GenerationProvider } from './interface'
import { MuAPIAdapter } from './image/muapi'

export function getImageProvider(env: Env): GenerationProvider {
  return new MuAPIAdapter(
    env.MUAPI_API_KEY,
    env.STORAGE,
    env.WORKER_URL ?? ''
  )
}
