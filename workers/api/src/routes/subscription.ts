import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env, Variables } from '../index'
import { createRazorpaySubscription } from '../services/razorpay'

export const subscription = new Hono<{ Bindings: Env; Variables: Variables }>()

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

function getLimit(tier: string | null | undefined): number {
  if (tier === 'standard' || tier === 'pro' || tier === 'ultra') return 30
  return 0 // Free tier has 0 video limit
}

// GET /api/subscription/status
subscription.get('/status', async (c) => {
  const userId = c.get('userId')
  const characterId = c.req.query('character_id')

  if (!characterId) {
    return c.json({ error: 'character_id query param is required', code: 'BAD_REQUEST' }, 400)
  }

  const { data: character, error } = await db(c.env)
    .from('characters')
    .select('id, subscription_tier, videos_used_this_month, videos_reset_at')
    .eq('id', characterId)
    .eq('user_id', userId)
    .single()

  if (error || !character) {
    return c.json({ error: 'Character not found or access denied', code: 'NOT_FOUND' }, 404)
  }

  const tier = character.subscription_tier ?? 'free'
  return c.json({
    data: {
      tier,
      videos_used: character.videos_used_this_month ?? 0,
      videos_limit: getLimit(tier),
      reset_at: character.videos_reset_at,
    },
  })
})

// POST /api/subscription/upgrade
subscription.post('/upgrade', async (c) => {
  const userId = c.get('userId')
  const userEmail = c.get('userEmail') ?? ''

  let body: { character_id?: unknown; tier?: unknown }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const characterId = typeof body.character_id === 'string' ? body.character_id.trim() : ''
  const tier = typeof body.tier === 'string' ? body.tier.trim() : ''

  if (!characterId) {
    return c.json({ error: 'character_id is required', code: 'BAD_REQUEST' }, 400)
  }
  if (tier !== 'standard' && tier !== 'pro' && tier !== 'ultra') {
    return c.json({ error: 'tier must be standard, pro, or ultra', code: 'BAD_REQUEST' }, 400)
  }

  // 1. Verify character ownership
  const { data: character, error } = await db(c.env)
    .from('characters')
    .select('id, name')
    .eq('id', characterId)
    .eq('user_id', userId)
    .single()

  if (error || !character) {
    return c.json({ error: 'Character not found or access denied', code: 'NOT_FOUND' }, 404)
  }

  // 2. Map tier to Razorpay Plan ID
  let planId = ''
  if (tier === 'standard') {
    planId = c.env.RAZORPAY_PLAN_STANDARD ?? 'plan_standard_test'
  } else if (tier === 'pro') {
    planId = c.env.RAZORPAY_PLAN_PRO ?? 'plan_pro_test'
  } else {
    planId = c.env.RAZORPAY_PLAN_ULTRA ?? 'plan_ultra_test'
  }

  try {
    // 3. Create Subscription in Razorpay
    const sub = await createRazorpaySubscription(c.env, planId, {
      character_id: characterId,
      user_id: userId,
      tier,
      user_email: userEmail,
    })

    // 4. Update the character record with the Razorpay subscription ID
    const { error: updateError } = await db(c.env)
      .from('characters')
      .update({ razorpay_subscription_id: sub.id })
      .eq('id', characterId)
      .eq('user_id', userId)

    if (updateError) {
      console.error('[subscription-upgrade] DB update failed:', updateError)
      return c.json({ error: 'Failed to link subscription in database', code: 'INTERNAL_ERROR' }, 500)
    }

    return c.json({
      data: {
        subscription_id: sub.id,
        checkout_url: sub.short_url,
        status: sub.status,
      },
    }, 201)
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Subscription creation failed'
    console.error('[subscription-upgrade] error:', err)
    return c.json({ error: msg, code: 'RAZORPAY_API_ERROR' }, 500)
  }
})
