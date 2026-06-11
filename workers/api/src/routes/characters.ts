import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import type { Variables } from '../middleware/auth'

const characters = new Hono<{ Bindings: Env; Variables: Variables }>()

const VALID_POSE_TYPES = new Set([
  'front', 'side', 'angled', 'backside', 'expertise_specific', 'other',
])
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png'])
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

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
      muapi: { model: 'flux-dev', steps: 28 },
    },
  }
}

// GET /api/characters
characters.get('/', async (c) => {
  const userId = c.get('userId')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', 1)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: 'Failed to fetch characters', code: 'DB_ERROR' }, 500)

  return c.json({ data: data ?? [], meta: { total: data?.length ?? 0 } })
})

// POST /api/characters
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

  if (!name) return c.json({ error: 'name is required', code: 'VALIDATION_ERROR' }, 400)
  if (!domain) return c.json({ error: 'domain is required', code: 'VALIDATION_ERROR' }, 400)

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

  if (error) return c.json({ error: 'Failed to create character', code: 'DB_ERROR' }, 500)

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

  if (error || !data) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

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

  if (!existing) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

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

  if (error) return c.json({ error: 'Failed to update character', code: 'DB_ERROR' }, 500)

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

  if (error) return c.json({ error: 'Failed to delete character', code: 'DB_ERROR' }, 500)

  return c.json({ data: { success: true } })
})

// POST /api/characters/:id/references — upload reference images to R2
characters.post('/:id/references', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  // Verify ownership
  const { data: character } = await supabase
    .from('characters')
    .select('id, name')
    .eq('id', id)
    .eq('user_id', userId)
    .eq('is_active', 1)
    .single()

  if (!character) return c.json({ error: 'Character not found', code: 'CHARACTER_NOT_FOUND' }, 404)

  let body: Record<string, string | File | (string | File)[]>
  try {
    body = await c.req.parseBody({ all: true })
  } catch {
    return c.json({ error: 'Invalid multipart form data', code: 'BAD_REQUEST' }, 400)
  }

  const rawFiles = body['files']
  const files: File[] = (Array.isArray(rawFiles) ? rawFiles : [rawFiles])
    .filter((v): v is File => v instanceof File)

  if (files.length === 0) {
    return c.json({ error: 'No files provided', code: 'VALIDATION_ERROR' }, 400)
  }

  let poseTypes: string[]
  try {
    const raw = body['pose_types']
    const poseTypesStr = Array.isArray(raw) ? raw[0] : raw
    poseTypes = JSON.parse(typeof poseTypesStr === 'string' ? poseTypesStr : '[]')
    if (!Array.isArray(poseTypes)) throw new Error('not array')
  } catch {
    return c.json({ error: 'pose_types must be a JSON array', code: 'VALIDATION_ERROR' }, 400)
  }

  // Validate each file
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return c.json(
        { error: `Invalid file type "${file.type}". Only image/jpeg and image/png are accepted.`, code: 'INVALID_FILE_TYPE' },
        400,
      )
    }
    if (file.size > MAX_FILE_SIZE) {
      return c.json(
        { error: `File "${file.name}" exceeds the 10 MB size limit.`, code: 'FILE_TOO_LARGE' },
        413,
      )
    }
  }

  // Upload each file to R2
  type RefObject = { url: string; pose_type: string; is_primary: boolean }
  const refs: RefObject[] = []

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const poseType = VALID_POSE_TYPES.has(poseTypes[i]) ? poseTypes[i] : 'other'
    const timestamp = Date.now() + i
    const key = `identity/${userId}/${id}/ref_${timestamp}_${poseType}.jpg`

    const buffer = await file.arrayBuffer()
    await c.env.STORAGE.put(key, buffer, {
      httpMetadata: { contentType: file.type },
    })

    refs.push({ url: key, pose_type: poseType, is_primary: false })
  }

  // First "front" image is primary; fall back to first image overall
  const firstFront = refs.findIndex((r) => r.pose_type === 'front')
  refs[firstFront >= 0 ? firstFront : 0].is_primary = true

  const { data: updated, error: updateError } = await supabase
    .from('characters')
    .update({
      reference_image_urls: JSON.stringify(refs),
      reference_images_ready: 1,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (updateError) return c.json({ error: 'Failed to save reference images', code: 'DB_ERROR' }, 500)

  return c.json({ data: updated }, 201)
})

// GET /api/characters/:id/references
characters.get('/:id/references', async (c) => {
  const userId = c.get('userId')
  const id = c.req.param('id')
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_SERVICE_KEY)

  const { data, error } = await supabase
    .from('characters')
    .select('reference_image_urls')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  let refs = []
  try {
    refs = JSON.parse(data.reference_image_urls ?? '[]')
  } catch {
    refs = []
  }

  return c.json({ data: refs })
})

export { characters }
