import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env, Variables } from '../index'

export const library = new Hono<{ Bindings: Env; Variables: Variables }>()

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

// GET /api/library?character_id=&type=all|text|image&page=1&limit=20
library.get('/', async (c) => {
  const userId = c.get('userId')

  const character_id = c.req.query('character_id')
  if (!character_id) {
    return c.json({ error: 'character_id query param is required', code: 'BAD_REQUEST' }, 400)
  }

  // Verify user owns the character
  const { data: character } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', character_id)
    .eq('user_id', userId)
    .single()

  if (!character) {
    return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)
  }

  const type  = c.req.query('type') ?? 'all'
  const page  = Math.max(1, parseInt(c.req.query('page')  ?? '1',  10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(c.req.query('limit') ?? '20', 10) || 20))
  const offset = (page - 1) * limit

  // Build data query
  let query = db(c.env)
    .from('generations')
    .select('*')
    .eq('character_id', character_id)
    .eq('user_id', userId)

  if (type === 'text')  query = query.eq('generation_type', 'text')
  if (type === 'image') query = query.eq('generation_type', 'image')

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) {
    return c.json({ error: 'Failed to fetch library', code: 'INTERNAL_ERROR' }, 500)
  }

  // Build count query (same filters, no pagination)
  let countQuery = db(c.env)
    .from('generations')
    .select('id', { count: 'exact', head: true })
    .eq('character_id', character_id)
    .eq('user_id', userId)

  if (type === 'text')  countQuery = countQuery.eq('generation_type', 'text')
  if (type === 'image') countQuery = countQuery.eq('generation_type', 'image')

  const { count } = await countQuery
  const total = count ?? 0

  return c.json({
    data: data ?? [],
    meta: {
      total,
      page,
      has_more: offset + limit < total,
    },
  })
})
