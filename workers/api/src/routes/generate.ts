import { Hono } from 'hono'
import type { Env } from '../index'
import type { Variables } from '../middleware/auth'

const generate = new Hono<{ Bindings: Env; Variables: Variables }>()

// POST /api/generate/image — trigger image generation via Provider Adapter
generate.post('/image', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

// GET /api/generate/image/:id — poll generation status
generate.get('/image/:id', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

export { generate }
