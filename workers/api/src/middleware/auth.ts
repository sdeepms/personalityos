import { createClient } from '@supabase/supabase-js'
import type { Context, Next } from 'hono'
import type { Env, Variables } from '../index'

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: 'Missing or invalid Authorization header', code: 'UNAUTHORIZED' }, 401)
  }

  const token = authorization.slice(7)
  const supabase = createClient(c.env.SUPABASE_URL, c.env.SUPABASE_ANON_KEY)

  const { data: { user }, error } = await supabase.auth.getUser(token)
  if (error || !user) {
    return c.json({ error: 'Invalid or expired token', code: 'UNAUTHORIZED' }, 401)
  }

  c.set('userId', user.id)
  c.set('userEmail', user.email ?? '')
  await next()
}
