import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import type { Variables } from '../middleware/auth'

const characters = new Hono<{ Bindings: Env; Variables: Variables }>()

const STYLE_DESCRIPTIONS: Record<string, string> = {
  engaging_explainer:
    'Your style is conversational and example-heavy. You make complex topics accessible.',
  academic_accessible:
    'Your style is formal, precise, and structured with academic rigor.',
  direct_mentor:
    'Your style is authoritative and direct. You give clear guidance without unnecessary elaboration.',
}

function buildDefaultPromptDna() {
  return {
    style_modifiers: [
      'professional portrait photography',
      'cinematic lighting',
      'sharp focus',
      'high detail',
    ],
    negative_prompt:
      'cartoon, anime, blurry, low quality, deformed, extra limbs, watermark, text overlay',
    color_palette: 'warm academic tones, earth colors, professional',
    aspect_preferences: {
      instagram: '1:1',
      linkedin: '4:5',
      x: '16:9',
      story: '9:16',
      reel: '9:16',
      carousel: '1:1',
    },
    provider_overrides: {
      muapi: {
        model: 'flux-dev',
        steps: 28,
      },
    },
  }
}

// GET /api/characters — list active characters for the authenticated user
characters.get('/', async (c) => {
  const userId = c.get('userId')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', 1)
    .order('created_at', { ascending: false })

  if (error) {
    return c.json({ error: 'Failed to fetch characters', code: 'DB_ERROR' }, 500)
  }

  return c.json({ data: data ?? [], meta: { total: data?.length ?? 0 } })
})

// POST /api/characters — create a new character with DNA assembly
characters.post('/', async (c) => {
  const userId = c.get('userId')

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const domain = typeof body.domain === 'string' ? body.domain.trim() : ''

  if (!name) {
    return c.json({ error: 'name is required', code: 'VALIDATION_ERROR' }, 400)
  }
  if (!domain) {
    return c.json({ error: 'domain is required', code: 'VALIDATION_ERROR' }, 400)
  }

  const gender = typeof body.gender === 'string' ? body.gender.trim() : 'neutral'
  const age_range = typeof body.age_range === 'string' ? body.age_range.trim() : '30s'
  const nationality = typeof body.nationality === 'string' ? body.nationality.trim() : 'Indian'
  const style_preset =
    typeof body.style_preset === 'string' ? body.style_preset.trim() : 'engaging_explainer'

  const styleDesc = STYLE_DESCRIPTIONS[style_preset] ?? STYLE_DESCRIPTIONS['engaging_explainer']

  const system_prompt =
    `You are ${name}, an expert in ${domain}. ` +
    `You are a ${gender} in your ${age_range}. ` +
    `You are ${nationality}. ${styleDesc}`

  const visual_style_prompt =
    `${nationality} ${gender}, ${age_range}, professional ${domain} expert, ` +
    `natural lighting, high quality portrait`

  const prompt_dna = JSON.stringify(buildDefaultPromptDna())

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('characters')
    .insert({
      user_id: userId,
      name,
      domain,
      gender,
      age_range,
      nationality,
      style_preset,
      system_prompt,
      visual_style_prompt,
      prompt_dna,
      dna_ready: 1,
      is_active: 1,
    })
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to create character', code: 'DB_ERROR' }, 500)
  }

  return c.json({ data }, 201)
})

// GET /api/characters/:id
characters.get('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', 1)
    .single()

  if (error || !data) {
    return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json({ data })
})

// PUT /api/characters/:id
characters.put('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')

  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data: existing } = await supabase
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!existing) {
    return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)
  }

  const allowedFields = ['name', 'domain', 'gender', 'age_range', 'nationality', 'style_preset', 'prompt_dna']
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const field of allowedFields) {
    if (body[field] !== undefined) updates[field] = body[field]
  }

  const { data, error } = await supabase
    .from('characters')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) {
    return c.json({ error: 'Failed to update character', code: 'DB_ERROR' }, 500)
  }

  return c.json({ data })
})

// DELETE /api/characters/:id — soft delete
characters.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { error } = await supabase
    .from('characters')
    .update({ is_active: 0, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', userId)

  if (error) {
    return c.json({ error: 'Failed to delete character', code: 'DB_ERROR' }, 500)
  }

  return c.json({ data: { success: true } })
})

// POST /api/characters/:id/references — Day 4
characters.post('/:id/references', (c) => {
  return c.json({ error: 'Not implemented', code: 'NOT_IMPLEMENTED' }, 501)
})

// GET /api/characters/:id/references
characters.get('/:id/references', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data } = await supabase
    .from('characters')
    .select('reference_image_urls')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  const urls = data?.reference_image_urls ? JSON.parse(data.reference_image_urls) : []
  return c.json({ data: urls })
})

export { characters }
