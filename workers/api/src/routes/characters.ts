import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env, Variables } from '../index'
import { getImageProvider } from '../providers/factory'
import { assemblePortraitPrompt, getStyleDescription, type PortraitPromptData } from '../services/portrait-assembler'

export const characters = new Hono<{ Bindings: Env; Variables: Variables }>()

const VALID_MIME_TYPES = ['image/jpeg', 'image/png']
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

type ReferenceImage = { url: string; pose_type: string; is_primary: boolean }

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

// POST /api/characters/preview-portrait
characters.post('/preview-portrait', async (c) => {
  let body: PortraitPromptData
  try {
    body = await c.req.json() as PortraitPromptData
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  console.log('[preview-portrait] generating for type:', body.character_type)
  const prompt = assemblePortraitPrompt(body)
  const result = await getImageProvider(c.env).generatePortrait(prompt, '1:1')
  return c.json({ image_url: result.outputUrl })
})

// POST /api/characters/edit-portrait
characters.post('/edit-portrait', async (c) => {
  let body: { current_image_url: string; edit_prompt: string }
  try {
    body = await c.req.json() as { current_image_url: string; edit_prompt: string }
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  console.log('[edit-portrait] editing image')
  const constrainedPrompt = `${body.edit_prompt}. Keep the person's face, identity, skin tone, and facial features exactly the same. Only apply the requested change. Do not alter the person's likeness in any way.`
  const result = await getImageProvider(c.env).editPortrait(body.current_image_url, constrainedPrompt, '1:1')
  return c.json({ image_url: result.outputUrl })
})

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

  const { name, domain, gender, age_range, nationality, style_preset, character_type, store_name } = body as Record<string, string | null | undefined>
  if (!name || !domain) {
    return c.json({ error: 'name and domain are required', code: 'BAD_REQUEST' }, 400)
  }

  const charType = (character_type as string | undefined) ?? 'educator'

  const skinTone = nationality?.toLowerCase() === 'indian' ? 'warm brown skin tone' : null
  const visual_style_prompt = [nationality, gender, age_range, skinTone, domain, 'professional, natural lighting']
    .filter(Boolean).join(', ')

  const styleDesc = getStyleDescription(charType, style_preset as string ?? '')

  let system_prompt: string
  if (charType === 'reseller') {
    const storeName = (store_name as string | null | undefined) ?? `${name}'s store`
    system_prompt = `You are ${name}, a brand model for ${storeName}. You create content that showcases products in an engaging way. Your communication style is ${styleDesc}. You write captions that highlight the product, mention the price when provided, and include a clear call to action. You only use details the user provides — never invent product specifications or prices.`
  } else if (charType === 'creator') {
    system_prompt = `You are ${name}, a ${domain} content creator. You create content that is ${styleDesc}. Your audience connects with you personally. You share your perspective, experiences, and opinions. You write in an authentic voice that feels genuine and engaging.`
  } else {
    system_prompt = [
      `You are ${name}, ${domain}.`,
      style_preset === 'academic_accessible' ? 'Your style is formal, structured, and precise.' : '',
      style_preset === 'engaging_explainer' ? 'Your style is conversational, example-heavy, and energetic.' : '',
      style_preset === 'direct_mentor' ? 'Your style is authoritative, brief, and no-nonsense.' : '',
      'You generate content in your authentic voice, staying true to your expertise and personality.',
    ].filter(Boolean).join(' ')
  }

  const prompt_dna = {
    style_modifiers: ['professional portrait photography', 'cinematic lighting', 'sharp focus', 'high detail'],
    negative_prompt: 'cartoon, anime, illustration, painting, blurry, low quality, low resolution, deformed, ugly, bad anatomy, extra limbs, extra fingers, six fingers, seven fingers, fused fingers, fingers merged into objects, fingers through objects, wrong number of fingers, mutated hands, malformed hands, floating limbs, disconnected limbs, different person, different face, different hairstyle, different clothing style, changed outfit, different outfit, suit when reference shows kurta, formal wear when reference shows casual, casual wear when reference shows formal, text on whiteboard, illegible text, garbled writing, words on board, watermark, signature, logo, nsfw, nudity, violence, overexposed, underexposed, grainy, noisy, artifacts, bad proportions, unrealistic proportions, skin color mismatch, different ethnicity than reference',
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
      character_type: charType,
      store_name: (store_name as string | null | undefined) ?? null,
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
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!existing) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  const allowed = ['name', 'domain', 'gender', 'age_range', 'nationality', 'style_preset', 'prompt_dna']
  const updates: Record<string, unknown> = {}
  for (const key of allowed) {
    if (key in body) updates[key] = body[key]
  }

  // Regenerate derived fields when identity changes
  const identityFields = ['name', 'domain', 'gender', 'age_range', 'nationality', 'style_preset']
  if (identityFields.some(k => k in body)) {
    const name        = (body.name        ?? existing.name)        as string
    const domain      = (body.domain      ?? existing.domain)      as string
    const gender      = (body.gender      ?? existing.gender)      as string | undefined
    const ageRange    = (body.age_range   ?? existing.age_range)   as string | undefined
    const nationality = (body.nationality ?? existing.nationality) as string | undefined
    const stylePreset = (body.style_preset ?? existing.style_preset) as string | undefined

    const skinTone = nationality?.toLowerCase() === 'indian' ? 'warm brown skin tone' : null
    updates.visual_style_prompt = [nationality, gender, ageRange, skinTone, domain, 'professional, natural lighting']
      .filter(Boolean).join(', ')

    updates.system_prompt = [
      `You are ${name}, ${domain}.`,
      stylePreset === 'academic_accessible' ? 'Your style is formal, structured, and precise.' : '',
      stylePreset === 'engaging_explainer'  ? 'Your style is conversational, example-heavy, and energetic.' : '',
      stylePreset === 'direct_mentor'       ? 'Your style is authoritative, brief, and no-nonsense.' : '',
      'You generate content in your authentic voice, staying true to your expertise and personality.',
    ].filter(Boolean).join(' ')
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

// GET /api/characters/:id/offers
characters.get('/:id/offers', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { data: character } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  const { data, error } = await db(c.env)
    .from('character_offers')
    .select('*')
    .eq('character_id', id)
    .eq('user_id', userId)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })

  if (error) return c.json({ error: 'Failed to fetch offers', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data: data ?? [] })
})

// POST /api/characters/:id/offers
characters.post('/:id/offers', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { data: character } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  let body: { label?: unknown; description?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const label       = typeof body.label       === 'string' ? body.label.trim()       : ''
  const description = typeof body.description === 'string' ? body.description.trim() : ''

  if (!label)                   return c.json({ error: 'label is required',                        code: 'BAD_REQUEST' }, 400)
  if (label.length > 30)        return c.json({ error: 'label must be 30 characters or fewer',     code: 'BAD_REQUEST' }, 400)
  if (!description)             return c.json({ error: 'description is required',                  code: 'BAD_REQUEST' }, 400)
  if (description.length > 200) return c.json({ error: 'description must be 200 characters or fewer', code: 'BAD_REQUEST' }, 400)

  const { count, error: countError } = await db(c.env)
    .from('character_offers')
    .select('id', { count: 'exact', head: true })
    .eq('character_id', id)
    .eq('user_id', userId)

  if (countError) return c.json({ error: 'Failed to check offer count', code: 'INTERNAL_ERROR' }, 500)
  if ((count ?? 0) >= 10) return c.json({ error: 'Maximum 10 templates allowed', code: 'LIMIT_REACHED' }, 400)

  const { data, error } = await db(c.env)
    .from('character_offers')
    .insert({
      id:           crypto.randomUUID(),
      character_id: id,
      user_id:      userId,
      label,
      description,
      sort_order:   0,
    })
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to create offer', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data }, 201)
})

// PUT /api/characters/:id/offers/:oid
characters.put('/:id/offers/:oid', async (c) => {
  const userId = c.get('userId')
  const { id, oid } = c.req.param()

  const { data: character } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  const { data: existingOffer } = await db(c.env)
    .from('character_offers')
    .select('id')
    .eq('id', oid)
    .eq('character_id', id)
    .eq('user_id', userId)
    .single()
  if (!existingOffer) return c.json({ error: 'Offer not found', code: 'NOT_FOUND' }, 404)

  let body: { label?: unknown; description?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const updates: Record<string, string> = {}
  if (typeof body.label === 'string') {
    const label = body.label.trim()
    if (label.length > 30) return c.json({ error: 'label must be 30 characters or fewer', code: 'BAD_REQUEST' }, 400)
    updates.label = label
  }
  if (typeof body.description === 'string') {
    const description = body.description.trim()
    if (description.length > 200) return c.json({ error: 'description must be 200 characters or fewer', code: 'BAD_REQUEST' }, 400)
    updates.description = description
  }

  const { data, error } = await db(c.env)
    .from('character_offers')
    .update(updates)
    .eq('id', oid)
    .eq('character_id', id)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to update offer', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data })
})

// DELETE /api/characters/:id/offers/:oid
characters.delete('/:id/offers/:oid', async (c) => {
  const userId = c.get('userId')
  const { id, oid } = c.req.param()

  const { data: character } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  const { data: existingOffer } = await db(c.env)
    .from('character_offers')
    .select('id')
    .eq('id', oid)
    .eq('character_id', id)
    .eq('user_id', userId)
    .single()
  if (!existingOffer) return c.json({ error: 'Offer not found', code: 'NOT_FOUND' }, 404)

  const { error } = await db(c.env)
    .from('character_offers')
    .delete()
    .eq('id', oid)
    .eq('character_id', id)
    .eq('user_id', userId)

  if (error) return c.json({ error: 'Failed to delete offer', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data: { deleted: true } })
})

// GET /api/characters/:id/products
characters.get('/:id/products', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  const { data: character } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  const { data, error } = await db(c.env)
    .from('character_products')
    .select('*')
    .eq('character_id', id)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) return c.json({ error: 'Failed to fetch products', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data: data ?? [] })
})

// POST /api/characters/:id/products
characters.post('/:id/products', async (c) => {
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

  const imageFile = body['file']
  if (!(imageFile instanceof File)) return c.json({ error: 'file is required', code: 'BAD_REQUEST' }, 400)

  const nameRaw = body['name']
  const name = typeof nameRaw === 'string' ? nameRaw.trim() : ''
  if (!name)              return c.json({ error: 'name is required',                        code: 'BAD_REQUEST' }, 400)
  if (name.length > 50)   return c.json({ error: 'name must be 50 characters or fewer',     code: 'BAD_REQUEST' }, 400)

  if (!VALID_MIME_TYPES.includes(imageFile.type)) {
    return c.json({ error: `Invalid file type: ${imageFile.type}. Only JPEG and PNG allowed.`, code: 'INVALID_FILE_TYPE' }, 400)
  }
  if (imageFile.size > MAX_FILE_SIZE) {
    return c.json({ error: 'File too large. Maximum 10 MB.', code: 'FILE_TOO_LARGE' }, 413)
  }

  const productId  = crypto.randomUUID()
  const contentType = imageFile.type
  const r2Path     = `products/${userId}/${id}/${productId}.jpg`
  const buffer     = await imageFile.arrayBuffer()
  await c.env.STORAGE.put(r2Path, buffer, { httpMetadata: { contentType } })

  const { data, error } = await db(c.env)
    .from('character_products')
    .insert({
      id:           productId,
      character_id: id,
      user_id:      userId,
      name,
      image_url:    r2Path,
    })
    .select()
    .single()

  if (error) return c.json({ error: 'Failed to create product', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data: { id: productId, name, image_url: r2Path, public_url: '/files/' + r2Path } }, 201)
})

// DELETE /api/characters/:id/products/:pid
characters.delete('/:id/products/:pid', async (c) => {
  const userId = c.get('userId')
  const { id, pid } = c.req.param()

  const { data: character } = await db(c.env)
    .from('characters')
    .select('id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)

  const { data: product } = await db(c.env)
    .from('character_products')
    .select('id, image_url')
    .eq('id', pid)
    .eq('character_id', id)
    .eq('user_id', userId)
    .single()
  if (!product) return c.json({ error: 'Product not found', code: 'NOT_FOUND' }, 404)

  await c.env.STORAGE.delete(product.image_url as string)

  const { error } = await db(c.env)
    .from('character_products')
    .delete()
    .eq('id', pid)
    .eq('character_id', id)
    .eq('user_id', userId)

  if (error) return c.json({ error: 'Failed to delete product', code: 'INTERNAL_ERROR' }, 500)
  return c.json({ data: { deleted: true } })
})

// DELETE /api/characters/:id
characters.delete('/:id', async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.param()

  // Step 1 — Verify ownership
  const { data: character } = await db(c.env)
    .from('characters')
    .select('id, user_id')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (!character) return c.json({ error: 'Character not found', code: 'NOT_FOUND' }, 404)
  console.log('[delete-character] step 1: verified ownership')

  // Step 2 — Delete R2 reference images
  try {
    const refList = await c.env.STORAGE.list({ prefix: `identity/${userId}/${id}/` })
    for (const obj of refList.objects) {
      await c.env.STORAGE.delete(obj.key)
    }
    console.log(`[delete-character] step 2: deleted ${refList.objects.length} R2 reference images`)
  } catch (err) {
    console.warn('[delete-character] step 2: R2 reference image delete failed, continuing', err)
  }

  // Step 3 — Delete R2 generated images
  try {
    const genList = await c.env.STORAGE.list({ prefix: `generations/${userId}/${id}/` })
    for (const obj of genList.objects) {
      await c.env.STORAGE.delete(obj.key)
    }
    console.log(`[delete-character] step 3: deleted ${genList.objects.length} R2 generated images`)
  } catch (err) {
    console.warn('[delete-character] step 3: R2 generated image delete failed, continuing', err)
  }

  // Step 4 — Delete character_offers
  const { error: offersError } = await db(c.env)
    .from('character_offers')
    .delete()
    .eq('character_id', id)
  if (offersError) console.warn('[delete-character] step 4: failed to delete offers', offersError)
  else console.log('[delete-character] step 4: deleted offers')

  // Step 5 — Delete character_products
  const { error: productsError } = await db(c.env)
    .from('character_products')
    .delete()
    .eq('character_id', id)
  if (productsError) console.warn('[delete-character] step 5: failed to delete products', productsError)
  else console.log('[delete-character] step 5: deleted products')

  // Step 6 — Delete generations
  const { error: gensError } = await db(c.env)
    .from('generations')
    .delete()
    .eq('character_id', id)
  if (gensError) console.warn('[delete-character] step 6: failed to delete generations', gensError)
  else console.log('[delete-character] step 6: deleted generations')

  // Step 7 — Delete character row
  const { error: charError } = await db(c.env)
    .from('characters')
    .delete()
    .eq('id', id)
    .eq('user_id', userId)
  if (charError) return c.json({ error: 'Failed to delete character', code: 'INTERNAL_ERROR' }, 500)
  console.log('[delete-character] step 7: deleted character row')

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
