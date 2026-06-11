import { Hono } from 'hono'
import { cors } from 'hono/cors'

export type Env = {
  // Secrets (from .dev.vars locally, wrangler secret put in production)
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_KEY: string
  OPENROUTER_API_KEY: string
  ANTHROPIC_API_KEY: string
  MUAPI_API_KEY: string
  POSTHOG_API_KEY: string
  // Vars (from wrangler.toml [vars])
  LLM_PROVIDER: string
}

const app = new Hono<{ Bindings: Env }>()

app.use('*', cors())

app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// Route modules — wired up as each day's work is completed:
// import { characters } from './routes/characters'
// import { chat }       from './routes/chat'
// import { generate }   from './routes/generate'
// import { library }    from './routes/library'
//
// app.route('/api/characters', characters)
// app.route('/api/chat',       chat)
// app.route('/api/generate',   generate)
// app.route('/api/library',    library)

export default app
