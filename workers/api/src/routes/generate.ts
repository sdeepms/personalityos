import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env, Variables } from '../index'
import { getImageProvider } from '../providers/factory'
import { assembleImagePrompt } from '../services/prompt-builder'
import type { CharacterForPrompt } from '../services/prompt-builder'

export const generate = new Hono<{ Bindings: Env; Variables: Variables }>()

type Character = CharacterForPrompt & {
  id: string
  user_id: string
  name: string
  reference_images_ready: number
}

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

async function checkGenerationLimit(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  type: 'text' | 'image'
): Promise<{ allowed: boolean; used: number; limit: number }> {
  const DAILY_LIMIT = 20
  const todayStart = new Date()
  todayStart.setUTCHours(0, 0, 0, 0)

  // Count today's generations
  const { count: used } = await supabase
    .from('generations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('generation_type', type)
    .gte('created_at', todayStart.toISOString())

  // Check for extra grants
  const { data: overrides } = await supabase
    .from('generation_overrides')
    .select('extra_text, extra_image')
    .eq('user_id', userId)
    .gte('granted_at', todayStart.toISOString())

  const extraGranted = (overrides ?? []).reduce((sum, row) => {
    return sum + (type === 'text' ? (row.extra_text ?? 0) : (row.extra_image ?? 0))
  }, 0)

  const totalLimit = DAILY_LIMIT + extraGranted
  const totalUsed = used ?? 0

  return {
    allowed: totalUsed < totalLimit,
    used: totalUsed,
    limit: totalLimit
  }
}

// POST /api/generate/image — synchronous, blocks until image is ready
generate.post('/image', async (c) => {
  const userId = c.get('userId')
  console.log('[generate/image] request from userId:', userId)

  try {
    // 1. Parse and validate body
    let body: {
      character_id?: string
      image_description?: string
      user_prompt?: string
      platform?: string
      correlation_id?: string
    }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
    }

    const { character_id, image_description, user_prompt, platform, correlation_id } = body
    if (!character_id || !image_description || !platform) {
      return c.json(
        { error: 'character_id, image_description, and platform are required', code: 'BAD_REQUEST' },
        400
      )
    }

    // 2. Verify ownership
    console.log('[generate/image] fetching character:', character_id)
    const { data: character, error: charError } = await db(c.env)
      .from('characters')
      .select('id, user_id, name, visual_style_prompt, prompt_dna, reference_image_urls, reference_images_ready')
      .eq('id', character_id)
      .eq('user_id', userId)
      .single<Character>()

    if (charError || !character) {
      console.error('[generate/image] character fetch error:', charError)
      return c.json({ error: 'Character not found', code: 'CHARACTER_NOT_FOUND' }, 404)
    }
    console.log('[generate/image] character ok, reference_images_ready:', character.reference_images_ready)

    // 3. Require reference images
    if (character.reference_images_ready !== 1) {
      return c.json(
        { error: 'Upload a reference photo first', code: 'REFERENCE_IMAGES_REQUIRED' },
        400
      )
    }

    const limitCheck = await checkGenerationLimit(
      db(c.env), userId, 'image'
    )
    if (!limitCheck.allowed) {
      return c.json({
        error: 'Daily image limit reached',
        code: 'IMAGE_LIMIT_REACHED',
        used: limitCheck.used,
        limit: limitCheck.limit
      }, 429)
    }

    // 4. Assemble prompt
    console.log('[generate/image] assembling prompt for platform:', platform)
    const assembled = assembleImagePrompt(character, image_description, platform)
    console.log('[generate/image] assembled — ref_url:', assembled.reference_image_url, 'aspect:', assembled.aspect_ratio, 'model:', assembled.model)

    // 5. Run generation synchronously
    console.log('[generate/image] calling generateImage...')
    const result = await getImageProvider(c.env).generateImage(assembled.prompt, {
      referenceImageUrl: assembled.reference_image_url ?? undefined,
      aspectRatio: assembled.aspect_ratio,
      negativePrompt: assembled.negative_prompt,
      model: assembled.model,
      userId,
      characterId: character_id,
    })
    console.log('[generate/image] generation done, outputUrl:', result.outputUrl, 'durationMs:', result.durationMs)

    // 6. Pre-generate row ID and save to R2 via base64 or CDN fallback
    const generationId = crypto.randomUUID()
    const r2Path = `generations/${userId}/${character_id}/${generationId}.png`
    let finalImageUrl = result.outputUrl
    if (result.imageBase64) {
      try {
        const buffer = Uint8Array.from(atob(result.imageBase64), c => c.charCodeAt(0)).buffer
        await c.env.STORAGE.put(r2Path, buffer, {
          httpMetadata: { contentType: 'image/png' },
        })
        finalImageUrl = `/files/${r2Path}`
        console.log('[generate/image] saved base64 to R2:', finalImageUrl)
      } catch (r2Err) {
        console.warn('[generate/image] R2 save failed, using CDN URL:', r2Err)
      }
    } else {
      console.log('[generate/image] no base64, using CDN URL')
    }

    // 7. Save completed row
    const { data: generation, error: insertError } = await db(c.env)
      .from('generations')
      .insert({
        id: generationId,
        character_id,
        user_id: userId,
        generation_type: 'image',
        platform,
        user_prompt: user_prompt ?? image_description,
        correlation_id: correlation_id || null,
        image_url: finalImageUrl,
        provider: result.provider,
        model_used: result.model,
        generation_time_ms: result.durationMs,
        status: 'completed',
      })
      .select('id')
      .single()

    if (insertError) {
      console.error('[generate/image] insert error (returning image anyway):', insertError)
      return c.json({ data: { image_url: finalImageUrl, generation_id: null } }, 201)
    }

    return c.json({ data: { image_url: finalImageUrl, generation_id: generation.id } }, 201)

  } catch (err) {
    console.error('[generate/image] unhandled error:', err)
    return c.json({
      error: err instanceof Error ? err.message : 'Unknown error',
      code: 'GENERATION_FAILED',
    }, 500)
  }
})

