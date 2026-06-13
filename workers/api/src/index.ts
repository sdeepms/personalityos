import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { characters } from './routes/characters'
import { chat } from './routes/chat'
import { generate } from './routes/generate'
import { library } from './routes/library'

export type Env = {
  // Secrets — set via `wrangler secret put` in production, `.dev.vars` locally
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_KEY: string
  OPENROUTER_API_KEY: string
  ANTHROPIC_API_KEY: string
  MUAPI_API_KEY: string
  POSTHOG_API_KEY: string
  // Vars — set in wrangler.toml [vars]
  LLM_PROVIDER: string
  ALLOWED_ORIGIN: string
  WORKER_URL: string
  // R2 binding
  STORAGE: R2Bucket
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
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
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

// All /api/* routes require a valid Supabase JWT
app.use('/api/*', authMiddleware)

app.route('/api/characters', characters)
app.route('/api/chat', chat)
app.route('/api/generate', generate)
app.route('/api/library', library)

export default app
