import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env, Variables } from '../index'
import { getImageProvider } from '../providers/factory'
import { assembleImagePrompt } from '../services/prompt-builder'
import type { CharacterForPrompt } from '../services/prompt-builder'

export const generate = new Hono<{ Bindings: Env; Variables: Variables }>()

// ─────────────────────────────────────────────────────────────────────────────
// REMOVE BEFORE PRODUCTION
// Test router mounted WITHOUT auth middleware (see index.ts registration order).
// Accepts user_id from request body for local Day 5 validation only.
// ─────────────────────────────────────────────────────────────────────────────
export const generateTest = new Hono<{ Bindings: Env }>()

type Character = CharacterForPrompt & {
  id: string
  user_id: string
  name: string
  reference_images_ready: number
}

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

// POST /api/generate/image
generate.post('/image', async (c) => {
  const userId = c.get('userId')

  // 1. Parse and validate body
  let body: { character_id?: string; image_description?: string; platform?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const { character_id, image_description, platform } = body
  if (!character_id || !image_description || !platform) {
    return c.json(
      { error: 'character_id, image_description, and platform are required', code: 'BAD_REQUEST' },
      400
    )
  }

  // 2. Verify ownership
  const { data: character, error: charError } = await db(c.env)
    .from('characters')
    .select('id, user_id, name, visual_style_prompt, prompt_dna, reference_image_urls, reference_images_ready')
    .eq('id', character_id)
    .eq('user_id', userId)
    .single<Character>()

  if (charError || !character) {
    return c.json({ error: 'Character not found', code: 'CHARACTER_NOT_FOUND' }, 404)
  }

  // 3. Require reference images
  if (character.reference_images_ready !== 1) {
    return c.json(
      { error: 'Upload a reference photo first', code: 'REFERENCE_IMAGES_REQUIRED' },
      400
    )
  }

  // 4. Assemble prompt from character DNA
  const assembled = assembleImagePrompt(character, image_description, platform)

  // 5. Call provider adapter
  let result
  try {
    result = await getImageProvider(c.env).generateImage(assembled.prompt, {
      referenceImageUrl: assembled.reference_image_url ?? undefined,
      aspectRatio: assembled.aspect_ratio,
      negativePrompt: assembled.negative_prompt,
      model: assembled.model,
      userId,
      characterId: character_id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return c.json({ error: message, code: 'GENERATION_FAILED' }, 500)
  }

  // 6. Insert generation record
  const { data: generation, error: insertError } = await db(c.env)
    .from('generations')
    .insert({
      character_id,
      user_id: userId,
      generation_type: 'image',
      platform,
      user_prompt: image_description,
      image_url: result.outputUrl,
      provider: result.provider,
      model_used: result.model,
      generation_time_ms: result.durationMs,
      status: 'completed',
    })
    .select('id')
    .single()

  if (insertError) {
    // Generation succeeded — return the URL even if DB write fails
    return c.json({ data: { image_url: result.outputUrl, generation_id: null } })
  }

  return c.json({ data: { image_url: result.outputUrl, generation_id: generation.id } }, 201)
})

// GET /api/generate/image/:id
generate.get('/image/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { data, error } = await db(c.env)
    .from('generations')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()

  if (error || !data) {
    return c.json({ error: 'Generation not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json({ data })
})

// REMOVE BEFORE PRODUCTION
// POST /api/generate/test-image — no auth, user_id from body
generateTest.post('/test-image', async (c) => {
  let body: { character_id?: string; image_description?: string; platform?: string; user_id?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const { character_id, image_description, platform, user_id } = body
  if (!character_id || !image_description || !platform || !user_id) {
    return c.json(
      { error: 'character_id, image_description, platform, and user_id are required', code: 'BAD_REQUEST' },
      400
    )
  }

  const { data: character, error: charError } = await db(c.env)
    .from('characters')
    .select('id, user_id, name, visual_style_prompt, prompt_dna, reference_image_urls, reference_images_ready')
    .eq('id', character_id)
    .eq('user_id', user_id)
    .single<Character>()

  if (charError || !character) {
    return c.json({ error: 'Character not found', code: 'CHARACTER_NOT_FOUND' }, 404)
  }

  if (character.reference_images_ready !== 1) {
    return c.json(
      { error: 'Upload a reference photo first', code: 'REFERENCE_IMAGES_REQUIRED' },
      400
    )
  }

  const assembled = assembleImagePrompt(character, image_description, platform)

  let result
  try {
    result = await getImageProvider(c.env).generateImage(assembled.prompt, {
      referenceImageUrl: assembled.reference_image_url ?? undefined,
      aspectRatio: assembled.aspect_ratio,
      negativePrompt: assembled.negative_prompt,
      model: assembled.model,
      userId: user_id,
      characterId: character_id,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Generation failed'
    return c.json({ error: message, code: 'GENERATION_FAILED' }, 500)
  }

  const { data: generation, error: insertError } = await db(c.env)
    .from('generations')
    .insert({
      character_id,
      user_id,
      generation_type: 'image',
      platform,
      user_prompt: image_description,
      image_url: result.outputUrl,
      provider: result.provider,
      model_used: result.model,
      generation_time_ms: result.durationMs,
      status: 'completed',
    })
    .select('id')
    .single()

  if (insertError) {
    return c.json({ data: { image_url: result.outputUrl, generation_id: null } })
  }

  return c.json({ data: { image_url: result.outputUrl, generation_id: generation.id } }, 201)
})
