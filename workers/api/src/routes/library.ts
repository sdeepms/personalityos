import { Hono } from 'hono'
import type { Env, Variables } from '../index'

export const library = new Hono<{ Bindings: Env; Variables: Variables }>()

library.get('/', async (c) => {
  return c.json({ error: 'Library endpoint not yet implemented', code: 'NOT_IMPLEMENTED' }, 501)
})
