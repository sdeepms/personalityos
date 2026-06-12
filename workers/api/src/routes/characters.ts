import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env, Variables } from '../index'

export const characters = new Hono<{ Bindings: Env; Variables: Variables }>()

const VALID_MIME_TYPES = ['image/jpeg', 'image/png']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

type ReferenceImage = { url: string; pose_type: string; is_primary: boolean }

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

// GET /api/characters
characters.get('/', async (c) => {
  const userId = c.get('userId')
  const { data, error } = await db(c.env)
    .from('characters')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: 'Failed to fetch characters', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data: data ?? [] })
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

  const { name, domain, gender, age_range, nationality, style_preset } = body as Record<string, string>
  if (!name || !domain) {
    return c.json({ error: 'name and domain are required', code: 'BAD_REQUEST' }, 400)
  }

  const skinTone = nationality?.toLowerCase() === 'indian' ? 'warm brown skin tone' : null
  const visual_style_prompt = [nationality, gender, age_range, skinTone, domain, 'professional, natural lighting']
    .filter(Boolean).join(', ')

  const system_prompt = [
    `You are ${name}, ${domain}.`,
    style_preset === 'academic_accessible' ? 'Your style is formal, structured, and precise.' : '',
    style_preset === 'engaging_explainer' ? 'Your style is conversational, example-heavy, and energetic.' : '',
    style_preset === 'direct_mentor' ? 'Your style is authoritative, brief, and no-nonsense.' : '',
    'You generate content in your authentic voice, staying true to your expertise and personality.',
  ].filter(Boolean).join(' ')

  const prompt_dna = {
    style_modifiers: ['professional portrait photography', 'cinematic lighting', 'sharp focus', 'high detail'],
    negative_prompt: 'cartoon, anime, blurry, low quality, deformed, extra limbs, extra fingers, six fingers, seven fingers, wrong number of fingers, wrong fingers, mutated hands, malformed hands, watermark, text overlay, ugly, bad anatomy, text on whiteboard, writing on whiteboard, writing on board, words on board, letters on board, illegible text, garbled text, garbled writing, words, letters, skin color mismatch',
    color_palette: 'warm professional tones, natural lighting',
    aspect_preferences: { instagram: '1:1', linkedin: '4:5', x: '16:9', story: '9:16', reel: '9:16', carousel: '1:1' },
    provider_overrides: { muapi: { model: 'flux-dev', steps: 28 } },
  }

  const { data, error } = await db(c.env)
    .from('characters')
    .insert({
      user_id: userId,
      name,
      domain,
      gender,
      age_range,
      nationality,
      style_preset,
      visual_style_prompt,
      system_prompt,
      prompt_dna: JSON.stringify(prompt_dna),
      dna_ready: 1,
      reference_images_ready: 0,
      reference_image_urls: '[]',
    })
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to create character', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data }, 201)
})

// GET /api/characters/:id
characters.get('/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { data, error } = await db(c.env)
    .from('characters')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)
  return c.json({ data })
})

// PUT /api/characters/:id
characters.put('/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()
  let body: Record<string, unknown>
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const { data: existing } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!existing) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  const allowed = ['name', 'domain', 'gender', 'age_range', 'nationality', 'style_preset', 'prompt_dna']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  const { data, error } = await db(c.env)
    .from('characters')
    .update(updates)
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to update character', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data })
})

// DELETE /api/characters/:id
characters.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { error } = await db(c.env)
    .from('characters')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)

  if (error) return c.json({ error: 'Failed to delete character', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data: { deleted: true } })
})

// POST /api/characters/:id/references
characters.post('/:id/references', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { data: character } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  let body: Record<string, string | File | (string | File)[]>
  try {
    body = await c.req.parseBody({ all: true })
  } catch {
    return c.json({ error: 'Invalid multipart form data', code: 'BAD_REQUEST' }, 400)
  }

  const rawFiles = body['files']
  const files: File[] = (Array.isArray(rawFiles) ? rawFiles : [rawFiles])
    .filter((v): v is File => v instanceof File)

  if (files.length === 0) return c.json({ error: 'At least one image file is required', code: 'BAD_REQUEST' }, 400)
  if (files.length > 5) return c.json({ error: 'Maximum 5 images allowed', code: 'BAD_REQUEST' }, 400)

  for (const file of files) {
    if (!VALID_MIME_TYPES.includes(file.type)) {
      return c.json({ error: `Invalid file type: ${file.type}. Only JPEG and PNG allowed.`, code: 'INVALID_FILE_TYPE' }, 400)
    }
    if (file.size > MAX_FILE_SIZE) {
      return c.json({ error: `File too large: ${file.name}. Maximum 10 MB.`, code: 'FILE_TOO_LARGE' }, 413)
    }
  }

  let poseTypes: string[] = []
  try {
    const rawPoseTypes = body['pose_types']
    const poseTypesStr = Array.isArray(rawPoseTypes) ? rawPoseTypes[0] : rawPoseTypes
    poseTypes = JSON.parse(typeof poseTypesStr === 'string' ? poseTypesStr : '[]')
  } catch {
    poseTypes = files.map(() => 'front')
  }

  const refs: ReferenceImage[] = []
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    const poseType = poseTypes[i] ?? 'other'
    const key = `identity/${userId}/${id}/ref_${Date.now() + i}_${poseType}.jpg`
    await c.env.STORAGE.put(key, await file.arrayBuffer(), {
      httpMetadata: { contentType: file.type },
    })
    refs.push({ url: key, pose_type: poseType, is_primary: false })
  }

  const firstFront = refs.findIndex((r) => r.pose_type === 'front')
  refs[firstFront >= 0 ? firstFront : 0].is_primary = true

  const { data, error } = await db(c.env)
    .from('characters')
    .update({
      reference_image_urls: JSON.stringify(refs),
      reference_images_ready: 1,
    })
    .eq('id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to save reference images', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data }, 201)
})

// GET /api/characters/:id/references
characters.get('/:id/references', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { data: character } = await db(c.env)
    .from('characters')
    .select('reference_image_urls, reference_images_ready')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  let refs: ReferenceImage[] = []
  try {
    refs = JSON.parse(character.reference_image_urls ?? '[]')
  } catch {
    refs = []
  }

  return c.json({ data: refs })
})
