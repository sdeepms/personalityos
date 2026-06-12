import { Hono } from 'hono'
import type { Env, Variables } from '../index'

export const chat = new Hono<{ Bindings: Env; Variables: Variables }>()

chat.post('/', async (c) => {
  return c.json({ error: 'Chat endpoint not yet implemented', code: 'NOT_IMPLEMENTED' }, 501)
})
