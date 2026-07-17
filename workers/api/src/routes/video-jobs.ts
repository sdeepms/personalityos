import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'
import type { Env, Variables } from '../index'

export const videoJobs = new Hono<{ Bindings: Env; Variables: Variables }>()

function db(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY)
}

async function triggerConsumer(env: Env, payload: { job_id: string; action: string }) {
  if (env.VIDEO_QUEUE) {
    try {
      await env.VIDEO_QUEUE.send(payload)
    } catch (e) {
      console.warn('[video-jobs] Queue send warning:', e)
    }
  }

  // HTTP trigger for local dev mode or direct execution
  try {
    const consumerUrl = (env as any).CONSUMER_URL || 'http://127.0.0.1:8788'
    await fetch(`${consumerUrl}/process-job`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    console.log(`[video-jobs] Direct HTTP trigger sent to consumer for job ${payload.job_id}`)
  } catch (err) {
    console.warn('[video-jobs] Direct HTTP trigger warning:', err)
  }
}

// POST /api/video-jobs — Create job & trigger Stage 1 queue
videoJobs.post('/', async (c) => {
  const userId = c.get('userId')

  let body: { creator_id?: string; topic?: string; niche?: string; language?: string }
  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body', code: 'BAD_REQUEST' }, 400)
  }

  const creatorId = typeof body.creator_id === 'string' ? body.creator_id.trim() : ''
  const topic = typeof body.topic === 'string' ? body.topic.trim() : ''
  const niche = typeof body.niche === 'string' ? body.niche.trim() : 'General'
  const language = typeof body.language === 'string' ? body.language.trim() : 'hi-IN'

  if (!creatorId || !topic) {
    return c.json({ error: 'creator_id and topic are required', code: 'BAD_REQUEST' }, 400)
  }

  // Fetch character subscription tier
  const { data: character, error: charError } = await db(c.env)
    .from('characters')
    .select('id, subscription_tier')
    .eq('id', creatorId)
    .eq('user_id', userId)
    .single()

  if (charError || !character) {
    return c.json({ error: 'Character not found or access denied', code: 'NOT_FOUND' }, 404)
  }

  const tier = character.subscription_tier || 'standard'

  // Insert video_job in Supabase
  const { data: job, error: insertError } = await db(c.env)
    .from('video_jobs')
    .insert({
      user_id: userId,
      creator_id: creatorId,
      tier,
      topic,
      niche,
      language,
      status: 'pending',
      current_step: 'Queued for processing',
    })
    .select('*')
    .single()

  if (insertError || !job) {
    console.error('[video-jobs] DB insert failed:', insertError)
    return c.json({ error: 'Failed to create video job', code: 'INTERNAL_ERROR' }, 500)
  }

  // Trigger Stage 1 processing
  await triggerConsumer(c.env, {
    job_id: job.id,
    action: 'start_pipeline',
  })

  return c.json({ data: job }, 201)
})

// GET /api/video-jobs — List user's video jobs
videoJobs.get('/', async (c) => {
  const userId = c.get('userId')

  const { data: jobs, error } = await db(c.env)
    .from('video_jobs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    return c.json({ error: 'Failed to fetch video jobs', code: 'INTERNAL_ERROR' }, 500)
  }

  return c.json({ data: jobs ?? [] })
})

// GET /api/video-jobs/:id — Fetch single video job
videoJobs.get('/:id', async (c) => {
  const userId = c.get('userId')
  const jobId = c.req.param('id')

  const { data: job, error } = await db(c.env)
    .from('video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (error || !job) {
    return c.json({ error: 'Video job not found', code: 'NOT_FOUND' }, 404)
  }

  return c.json({ data: job })
})

// POST /api/video-jobs/:id/approve — User approves script & triggers Stage 2
videoJobs.post('/:id/approve', async (c) => {
  const userId = c.get('userId')
  const jobId = c.req.param('id')

  let body: { approved_script?: string } = {}
  try {
    body = await c.req.json()
  } catch {
    // Body is optional if script wasn't modified
  }

  // Verify job ownership and status
  const { data: job, error: fetchError } = await db(c.env)
    .from('video_jobs')
    .select('*')
    .eq('id', jobId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !job) {
    return c.json({ error: 'Video job not found', code: 'NOT_FOUND' }, 404)
  }

  const scriptToApprove = typeof body.approved_script === 'string' && body.approved_script.trim()
    ? body.approved_script.trim()
    : job.generated_script

  // Update status to 'approved'
  const { data: updatedJob, error: updateError } = await db(c.env)
    .from('video_jobs')
    .update({
      approved_script: scriptToApprove,
      status: 'approved',
      current_step: 'Script approved, starting generation',
      approved_at: new Date().toISOString(),
    })
    .eq('id', jobId)
    .select('*')
    .single()

  if (updateError || !updatedJob) {
    console.error('[video-jobs] Script approval update failed:', updateError)
    return c.json({ error: 'Failed to approve script', code: 'INTERNAL_ERROR' }, 500)
  }

  // Trigger Stage 2 processing
  await triggerConsumer(c.env, {
    job_id: jobId,
    action: 'continue_after_approval',
  })

  return c.json({ data: updatedJob })
})

