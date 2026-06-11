import { Hono } from 'hono'
import type { Env } from '../index'
import type { Variables } from '../middleware/auth'

const chat = new Hono<{ Bindings: Env; Variables: Variables }>()

// POST /api/chat — Day 8
chat.post('/', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

export { chat }
