import { Hono } from 'hono'
import type { Env } from '../index'
import type { Variables } from '../middleware/auth'

const library = new Hono<{ Bindings: Env; Variables: Variables }>()

// GET /api/library — paginated generation history for a character
library.get('/', (c) => {
  return c.json({ data: [], meta: { total: 0, page: 1, has_more: false } })
})

export { library }
