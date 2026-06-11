import { Hono } from 'hono'
import type { Env } from '../index'
import type { Variables } from '../middleware/auth'

const library = new Hono<{ Bindings: Env; Variables: Variables }>()

// GET /api/library — Day 10
library.get('/', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

export { library }
