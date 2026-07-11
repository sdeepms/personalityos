import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env } from '../index'
import { verifyRazorpaySignature } from '../services/razorpay'

export const webhooks = new Hono<{ Bindings: Env }>()

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

// POST /razorpay-webhook
webhooks.post('/razorpay', async (c) => {
  const signature = c.req.header('X-Razorpay-Signature')
  const webhookSecret = c.env.RAZORPAY_WEBHOOK_SECRET

  if (!signature) {
    console.warn('[razorpay-webhook] Missing signature header')
    return c.json({ error: 'Missing signature header' }, 400)
  }

  // 1. Read raw body as text for verification
  const rawBody = await c.req.text()

  // 2. Verify signature if webhook secret is set in config
  if (webhookSecret) {
    const isValid = await verifyRazorpaySignature(rawBody, signature, webhookSecret)
    if (!isValid) {
      console.warn('[razorpay-webhook] Signature verification failed')
      return c.json({ error: 'Invalid signature' }, 400)
    }
  } else {
    console.warn('[razorpay-webhook] RAZORPAY_WEBHOOK_SECRET not configured, skipping signature verification')
  }

  // 3. Parse JSON body
  let body: any
  try {
    body = JSON.parse(rawBody)
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  const event = body.event
  const payload = body.payload

  console.log(`[razorpay-webhook] Received event: ${event}`)

  if (event === 'subscription.charged') {
    const subscriptionEntity = payload.subscription?.entity
    const subId = subscriptionEntity?.id
    const notes = subscriptionEntity?.notes
    const characterId = notes?.character_id
    const tier = notes?.tier || 'standard'
    const currentEnd = subscriptionEntity?.current_end

    if (!subId) {
      return c.json({ error: 'Missing subscription ID in payload' }, 400)
    }

    console.log(`[razorpay-webhook] Processing subscription.charged for subId: ${subId}, characterId: ${characterId}, tier: ${tier}`)

    // Convert UNIX current_end timestamp to ISO string
    const resetDate = currentEnd 
      ? new Date(currentEnd * 1000).toISOString() 
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    // Find character by subscription ID or characterId (backup fallback)
    const supabase = db(c.env)
    let query = supabase.from('characters').update({
      subscription_tier: tier,
      videos_used_this_month: 0,
      videos_reset_at: resetDate,
      avatar_ready: true, // Mark avatar/creator setup as ready or active
    })

    if (characterId) {
      query = query.eq('id', characterId)
    } else {
      query = query.eq('razorpay_subscription_id', subId)
    }

    const { error } = await query

    if (error) {
      console.error('[razorpay-webhook] Failed to update character subscription:', error)
      return c.json({ error: 'Database update failed' }, 500)
    }

    console.log('[razorpay-webhook] Successfully updated character subscription limits')
  } 
  
  else if (
    event === 'subscription.cancelled' || 
    event === 'subscription.halted' || 
    event === 'subscription.completed'
  ) {
    const subscriptionEntity = payload.subscription?.entity
    const subId = subscriptionEntity?.id
    const notes = subscriptionEntity?.notes
    const characterId = notes?.character_id

    if (!subId) {
      return c.json({ error: 'Missing subscription ID in payload' }, 400)
    }

    console.log(`[razorpay-webhook] Processing cancellation event: ${event} for subId: ${subId}`)

    // Demote character to free tier
    const supabase = db(c.env)
    let query = supabase.from('characters').update({
      subscription_tier: 'free',
      razorpay_subscription_id: null,
    })

    if (characterId) {
      query = query.eq('id', characterId)
    } else {
      query = query.eq('razorpay_subscription_id', subId)
    }

    const { error } = await query

    if (error) {
      console.error('[razorpay-webhook] Failed to demote character subscription:', error)
      return c.json({ error: 'Database update failed' }, 500)
    }

    console.log('[razorpay-webhook] Successfully demoted character to free tier')
  }

  return c.json({ received: true })
})
