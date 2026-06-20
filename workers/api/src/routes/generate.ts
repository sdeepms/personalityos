import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import { AwsClient } from 'aws4fetch'
import type { Env, Variables } from '../index'
import { getImageProvider } from '../providers/factory'
import { assembleImagePrompt } from '../services/prompt-builder'
import type { CharacterForPrompt } from '../services/prompt-builder'
import type { GenerationResult } from '../providers/interface'
import { detectProductCategory, buildProductPrompt } from '../services/product-prompt-builder'

export const generate = new Hono<{ Bindings: Env; Variables: Variables }>()

type Attachment = {
  type: 'product_image' | 'reference_image'
  public_url: string
  label: string
}

type Character = CharacterForPrompt & {
  id: string
  user_id: string
  name: string
  reference_images_ready: number
  character_type: string | null
  gender: string | null
  nationality: string | null
  age_range: string | null
  style_preset: string | null
}

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

async function checkGenerationLimit(
  supabase: ReturnType<typeof db>,
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

  const extraGranted = (overrides ?? []).reduce((sum, row: { extra_text?: number | null; extra_image?: number | null }) => {
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
      attachments?: Attachment[]
    }
    try {
      body = await c.req.json()
    } catch {
      return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
    }

    const { character_id, image_description, user_prompt, platform, correlation_id, attachments } = body
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
      .select('id, user_id, name, visual_style_prompt, prompt_dna, reference_image_urls, reference_images_ready, character_type, gender, nationality, age_range, style_preset')
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

    // 4-5. Determine generation path and run
    const productAttachment = attachments?.find(a => a.type === 'product_image')
    let generationType = 'image'

    console.log('[generate/image] assembling prompt for platform:', platform)
    const assembled = assembleImagePrompt(character, image_description, platform)

    let result: GenerationResult
    if (productAttachment && character.character_type === 'reseller') {
      const category = detectProductCategory(productAttachment.label)
      const productPrompt = buildProductPrompt(
        productAttachment.label,
        category,
        {
          gender:         character.gender         ?? 'neutral',
          nationality:    character.nationality     ?? 'Indian',
          age_range:      character.age_range       ?? '30s',
          style_preset:   character.style_preset    ?? 'warm',
          character_type: character.character_type  ?? 'reseller',
        }
      )
      console.log('[generate/image] product category:', category)
      console.log('[generate/image] product prompt:', productPrompt.slice(0, 100))
      result = await getImageProvider(c.env).generateImage(
        productPrompt,
        {
          referenceImageUrl: productAttachment.public_url,
          aspectRatio:       assembled.aspect_ratio,
          negativePrompt:    'blurry, low quality, deformed, cartoon, anime, wrong product, different product, different color, text overlay, watermark, ugly, bad anatomy',
          model:             'nano-banana-edit',
          userId,
          characterId:       character_id,
        }
      )
      generationType = 'product_image'
      console.log('[generate/image] product generation done:', result.outputUrl)
    } else {
      console.log('[generate/image] assembled — ref_url:', assembled.reference_image_url, 'aspect:', assembled.aspect_ratio, 'model:', assembled.model)
      console.log('[generate/image] calling generateImage...')
      result = await getImageProvider(c.env).generateImage(assembled.prompt, {
        referenceImageUrl: assembled.reference_image_url ?? undefined,
        aspectRatio:       assembled.aspect_ratio,
        negativePrompt:    assembled.negative_prompt,
        model:             assembled.model,
        userId,
        characterId:       character_id,
      })
      console.log('[generate/image] generation done, outputUrl:', result.outputUrl, 'durationMs:', result.durationMs)
    }

    // 6. Pre-generate row ID and save to R2 via base64 or CDN fallback
    const generationId = crypto.randomUUID()
    const r2Path = `generations/${userId}/${character_id}/${generationId}.png`
    const safeImageUrl = (
      result.outputUrl &&
      result.outputUrl !== 'null' &&
      result.outputUrl !== 'undefined'
    ) ? result.outputUrl : null
    if (!safeImageUrl) {
      console.warn('[generate/image] outputUrl was null/invalid:', result.outputUrl)
    }
    let finalImageUrl: string | null = safeImageUrl
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
        generation_type: generationType,
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

// POST /api/generations/:id/presign-upload
generate.post('/:id/presign-upload', async (c) => {
  const userId = c.get('userId')
  const generationId = c.req.param('id')

  const { data: generation, error } = await db(c.env)
    .from('generations')
    .select('id, character_id')
    .eq('id', generationId)
    .eq('user_id', userId)
    .single<{ id: string; character_id: string }>()

  if (error || !generation) {
    return c.json({ error: 'Generation not found', code: 'NOT_FOUND' }, 404)
  }

  const r2Path = `generations/${userId}/${generation.character_id}/${generationId}.png`

  const r2 = new AwsClient({
    accessKeyId: c.env.R2_ACCESS_KEY_ID,
    secretAccessKey: c.env.R2_SECRET_ACCESS_KEY,
    service: 's3',
    region: 'auto',
  })

  const url = new URL(`https://${c.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/personalityos-storage/${r2Path}`)
  url.searchParams.set('X-Amz-Expires', '900')

  const signed = await r2.sign(
    new Request(url.toString(), { method: 'PUT' }),
    { aws: { signQuery: true } }
  )

  return c.json({ upload_url: signed.url, r2_path: r2Path })
})

// PATCH /api/generations/:id/confirm-save
generate.patch('/:id/confirm-save', async (c) => {
  const userId = c.get('userId')
  const generationId = c.req.param('id')

  const { data: generation, error: fetchError } = await db(c.env)
    .from('generations')
    .select('id')
    .eq('id', generationId)
    .eq('user_id', userId)
    .single<{ id: string }>()

  if (fetchError || !generation) {
    return c.json({ error: 'Generation not found', code: 'NOT_FOUND' }, 404)
  }

  let body: { r2_path?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const { r2_path } = body
  if (!r2_path) {
    return c.json({ error: 'r2_path is required', code: 'BAD_REQUEST' }, 400)
  }

  const permanentUrl = '/files/' + r2_path

  const { error: updateError } = await db(c.env)
    .from('generations')
    .update({ image_url: permanentUrl })
    .eq('id', generationId)
    .eq('user_id', userId)

  if (updateError) {
    console.error('[confirm-save] update error:', updateError)
    return c.json({ error: 'Failed to update generation', code: 'UPDATE_FAILED' }, 500)
  }

  return c.json({ permanent_url: permanentUrl })
})

