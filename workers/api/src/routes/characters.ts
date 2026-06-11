import { Hono } from 'hono'
import type { Env } from '../index'
import type { Variables } from '../middleware/auth'

const characters = new Hono<{ Bindings: Env; Variables: Variables }>()

// GET /api/characters — list all characters for the authenticated user
characters.get('/', (c) => {
  const userId = c.get('userId')
  return c.json({ data: [], meta: { total: 0, page: 1, has_more: false } })
})

// POST /api/characters — create a new character
characters.post('/', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

// GET /api/characters/:id — get a single character
characters.get('/:id', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

// PUT /api/characters/:id — update a character
characters.put('/:id', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

// DELETE /api/characters/:id — soft-delete a character
characters.delete('/:id', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

// POST /api/characters/:id/references — upload reference images
characters.post('/:id/references', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

// GET /api/characters/:id/references — list reference images
characters.get('/:id/references', (c) => {
  return c.json({ data: [] })
})

export { characters }
