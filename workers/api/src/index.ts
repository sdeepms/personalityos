import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient } from '@supabase/supabase-js'
import { authMiddleware } from './middleware/auth'
import { characters } from './routes/characters'
import { chat } from './routes/chat'
import { generate } from './routes/generate'
import { library } from './routes/library'
import { subscription } from './routes/subscription'
import { webhooks } from './routes/webhooks'

export type Env = {
  // Secrets — set via `wrangler secret put` in production, `.dev.vars` locally
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_KEY: string
  OPENROUTER_API_KEY: string
  ANTHROPIC_API_KEY: string
  MUAPI_API_KEY: string
  POSTHOG_API_KEY: string
  R2_ACCESS_KEY_ID: string
  R2_SECRET_ACCESS_KEY: string
  R2_ACCOUNT_ID: string
  // Razorpay keys
  RAZORPAY_KEY_ID: string
  RAZORPAY_KEY_SECRET: string
  RAZORPAY_WEBHOOK_SECRET: string
  RAZORPAY_PLAN_STANDARD?: string
  RAZORPAY_PLAN_PRO?: string
  RAZORPAY_PLAN_ULTRA?: string
  // Video provider keys

  SUBMAGIC_API_KEY?: string
  CREATOMATE_API_KEY?: string
  // Vars — set in wrangler.toml [vars]
  LLM_PROVIDER: string
  ALLOWED_ORIGIN: string
  WORKER_URL: string
  // R2 binding
  STORAGE: R2Bucket
  // Video Queue binding
  VIDEO_QUEUE: Queue
}

export type Variables = {
  userId: string
  userEmail: string
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>()

// CORS — allow only listed origins
app.use('*', (c, next) => {
  const origins = (c.env.ALLOWED_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
  return cors({
    origin: (origin) => (origins.includes(origin) ? origin : null),
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  })(c, next)
})

// Public health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Public R2 file serving — no auth required
app.get('/files/*', async (c) => {
  const path = c.req.path.slice('/files/'.length)

  if (!path) {
    return c.json({ error: 'No path specified' }, 400)
  }

  const object = await c.env.STORAGE.get(path)

  if (!object) {
    return c.json({ error: 'File not found' }, 404)
  }

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('etag', object.httpEtag)
  headers.set('cache-control', 'public, max-age=31536000')

  return new Response(object.body, { headers })
})

app.post('/api/feedback/request-more', async (c) => {
  // Verify JWT
  const authHeader = c.req.header('Authorization')
  const token = authHeader?.replace('Bearer ', '')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  const supabase = createClient(
    c.env.SUPABASE_URL,
    c.env.SUPABASE_SERVICE_KEY
  )
  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) return c.json({ error: 'Unauthorized' }, 401)

  const body = await c.req.json()
  const feedback = body.feedback ?? ''

  // Insert override granting 5 extra of each
  await supabase.from('generation_overrides').insert({
    user_id: user.id,
    extra_text: 5,
    extra_image: 5,
    feedback: feedback.slice(0, 500)
  })

  return c.json({
    data: {
      message: 'Thank you! 5 extra generations added.',
      extra_text: 5,
      extra_image: 5
    }
  })
})

// Public webhooks (bypasses Supabase JWT auth, validated via Razorpay signature)
app.route('/webhooks', webhooks)

// All /api/* routes require a valid Supabase JWT
app.use('/api/*', authMiddleware)

// POST /api/upload/attachment
app.post('/api/upload/attachment', async (c) => {
  const userId = c.get('userId')

  let body: Record<string, string | File | (string | File)[]>
  try {
    body = await c.req.parseBody({ all: true })
  } catch {
    return c.json({ error: 'Invalid multipart form data', code: 'BAD_REQUEST' }, 400)
  }
  const imageFile = body['file']
  if (!(imageFile instanceof File)) return c.json({ error: 'file is required', code: 'BAD_REQUEST' }, 400)

  const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp']
  const mimeType = imageFile.type
  if (mimeType && !validMimeTypes.includes(mimeType)) {
    return c.json({ error: `Invalid file type: ${mimeType}`, code: 'INVALID_FILE_TYPE' }, 400)
  }
  if (imageFile.size > 10 * 1024 * 1024) {
    return c.json({ error: 'File too large. Maximum 10 MB.', code: 'FILE_TOO_LARGE' }, 413)
  }

  const id          = crypto.randomUUID()
  const contentType = imageFile.type || 'image/jpeg'
  const ext         = imageFile.type === 'image/png' ? 'png'
    : imageFile.type === 'image/webp' ? 'webp'
    : 'jpg'
  const r2Path      = `attachments/${userId}/${id}.${ext}`
  const buffer      = await imageFile.arrayBuffer()
  await c.env.STORAGE.put(r2Path, buffer, { httpMetadata: { contentType } })

  return c.json({
    id,
    r2_path:    r2Path,
    public_url: `/files/${r2Path}`,
  })
})

import { videoJobs } from './routes/video-jobs'

app.route('/api/characters', characters)
app.route('/api/chat', chat)
app.route('/api/generate', generate)
app.route('/api/generations', generate)
app.route('/api/library', library)
app.route('/api/subscription', subscription)
app.route('/api/video-jobs', videoJobs)

export default app

