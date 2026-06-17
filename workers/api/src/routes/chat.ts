import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env, Variables } from '../index'
import { OpenRouterAdapter } from '../providers/text/openrouter'
import { AnthropicAdapter } from '../providers/text/anthropic'

export const chat = new Hono<{ Bindings: Env; Variables: Variables }>()

type Character = {
  id: string
  user_id: string
  system_prompt: string | null
}

const VALID_PLATFORMS = ['instagram', 'linkedin', 'x', 'carousel', 'story', 'general'] as const
type Platform = typeof VALID_PLATFORMS[number]

const PLATFORM_RULES: Record<Platform, string> = {
  instagram:
    'Caption 150-220 words, hook first line, 1-2 emojis naturally placed, 5-7 hashtags at end, ends with question',
  linkedin:
    'Caption 200-400 words, strong opinion as first line, no hashtags in body, 3-5 hashtags at very end, professional personal tone',
  x:
    'Thread of 5-7 tweets, each under 280 chars, numbered 1/7, hook on tweet 1, CTA on final tweet. caption field contains all tweets separated by newlines',
  carousel:
    '5-7 slide captions, each one punchy sentence, builds on previous. caption field contains all slides separated by ---',
  story:
    '50-80 words, single clear point, very punchy. One emoji maximum.',
  general:
    '200-300 words, natural and engaging',
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

function getLLMAdapter(env: Env) {
  if (env.LLM_PROVIDER === 'anthropic') {
    return new AnthropicAdapter(env.ANTHROPIC_API_KEY)
  }
  return new OpenRouterAdapter(env.OPENROUTER_API_KEY)
}

function parseJsonResponse(raw: string): Record<string, unknown> {
  try {
    return JSON.parse(raw) as Record<string, unknown>
  } catch {
    const stripped = raw.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '').trim()
    return JSON.parse(stripped) as Record<string, unknown>
  }
}

// POST /api/chat
chat.post('/', async (c) => {
  const userId = c.get('userId')

  // 1. Parse body
  let body: { character_id?: string; message?: string; platform?: string; correlation_id?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const { character_id, message, platform, correlation_id } = body

  // 2. Validate required fields
  if (!character_id || !message || !platform) {
    return c.json(
      { error: 'character_id, message, and platform are required', code: 'BAD_REQUEST' },
      400
    )
  }

  if (!VALID_PLATFORMS.includes(platform as Platform)) {
    return c.json(
      { error: `platform must be one of: ${VALID_PLATFORMS.join(', ')}`, code: 'BAD_REQUEST' },
      400
    )
  }

  const typedPlatform = platform as Platform

  // 3. Verify ownership
  const { data: character, error: charError } = await db(c.env)
    .from('characters')
    .select('id, user_id, system_prompt')
    .eq('id', character_id)
    .eq('user_id', userId)
    .single<Character>()

  if (charError || !character) {
    return c.json({ error: 'Character not found', code: 'CHARACTER_NOT_FOUND' }, 404)
  }

  const limitCheck = await checkGenerationLimit(
    db(c.env), userId, 'text'
  )
  if (!limitCheck.allowed) {
    return c.json({
      error: 'Daily caption limit reached',
      code: 'CAPTION_LIMIT_REACHED',
      used: limitCheck.used,
      limit: limitCheck.limit
    }, 429)
  }

  // 4. Build system prompt
  const formatRules = PLATFORM_RULES[typedPlatform]
  const systemPrompt = `${character.system_prompt ?? ''}

PLATFORM: ${typedPlatform}
FORMAT RULES: ${formatRules}

CONTENT INSTRUCTION:
The user's message may mention specific real people, events,
places, organizations, or objects by name.
If it does, incorporate those exact names naturally into the caption.
STRICT RULE: Only use facts that the user explicitly provided
in their message. Do not add biographical details, dates,
statistics, or any facts about real people that the user
did not mention. If you don't know a specific detail,
describe the theme or lesson instead — never invent facts.
It is better to write a thematic caption than a factually
wrong one.

For image_description: include the visual context from
the user's message (e.g. courtroom, highway, parliament)
but keep it to setting and mood — no invented facts.

Always respond with valid JSON only. No markdown. No other text.
Schema:
{
  "caption": "string",
  "image_description": "string (one sentence scene description featuring the character)",
  "platform": "string",
  "hashtags": ["string"]
}`

  // 5. Call LLM
  const adapter = getLLMAdapter(c.env)
  let llmResult: Awaited<ReturnType<typeof adapter.generateText>>
  try {
    llmResult = await adapter.generateText(systemPrompt, message)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'LLM call failed'
    return c.json({ error: msg, code: 'LLM_FAILED' }, 500)
  }

  // 6. Parse and validate JSON response
  let parsed: Record<string, unknown>
  try {
    parsed = parseJsonResponse(llmResult.text)
  } catch {
    return c.json({ error: 'LLM returned invalid JSON', code: 'LLM_PARSE_ERROR' }, 500)
  }

  const caption = typeof parsed.caption === 'string' ? parsed.caption : ''
  const image_description = typeof parsed.image_description === 'string' ? parsed.image_description : ''
  const hashtags = Array.isArray(parsed.hashtags) ? (parsed.hashtags as string[]) : []

  if (!caption) {
    return c.json({ error: 'LLM response missing caption', code: 'LLM_PARSE_ERROR' }, 500)
  }

  // 7. Save to generations table
  const { data: generation, error: insertError } = await db(c.env)
    .from('generations')
    .insert({
      character_id,
      user_id: userId,
      generation_type: 'text',
      platform: typedPlatform,
      user_prompt: message,
      text_output: caption,
      correlation_id: correlation_id || null,
      provider: llmResult.provider,
      model_used: llmResult.model,
      generation_time_ms: llmResult.durationMs,
      status: 'completed',
    })
    .select('id')
    .single()

  const generation_id = insertError ? null : generation?.id ?? null

  // 8. Return result
  return c.json({
    data: { caption, image_description, platform: typedPlatform, hashtags, generation_id },
  }, 201)
})

