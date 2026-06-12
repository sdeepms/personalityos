import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { authMiddleware } from './middleware/auth'
import { characters } from './routes/characters'
import { chat, chatTest } from './routes/chat'
import { generate, generateTest } from './routes/generate'
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

// REMOVE BEFORE PRODUCTION — test endpoints registered before auth middleware
app.route('/api/generate', generateTest)
app.route('/api/chat', chatTest)

// All /api/* routes require a valid Supabase JWT
app.use('/api/*', authMiddleware)

app.route('/api/characters', characters)
app.route('/api/chat', chat)
app.route('/api/generate', generate)
app.route('/api/library', library)

export default app
