# PersonalityOS — Claude Operating Manual

**This file is the first thing every Claude Code session must read.**
**Last Updated:** June 2026

---

## What PersonalityOS Is

PersonalityOS is a Digital Identity Operating System for AI content creators.

Users create AI characters (called "characters") once — giving them a name, face, personality, and communication style. That character becomes a permanent Digital DNA record. Every piece of content generated (captions, images) is driven by that DNA, producing consistent output without the user re-explaining anything.

The core promise: **Create a character once. Use it everywhere. Forever.**

The product has a chat interface. Users type a topic. They select a platform (Instagram, LinkedIn, X). They receive a platform-ready caption in their character's voice + a generated image of their character. Both are saved to a permanent asset library.

---

## Current Phase

**V1 Build — 14-Day Plan**

V1 must prove: consistent character images + social-ready captions from a chat interface.

Check `docs/14_DAY_EXECUTION_PLAN.md` for the current day and what is built so far.

---

## The Stack (Non-Negotiable)

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Next.js 14, TypeScript, Tailwind CSS, shadcn/ui | App Router only |
| Backend | Cloudflare Workers + Hono | One Worker, not multiple |
| Database | Supabase PostgreSQL | The ONLY database in V1 |
| Auth | Supabase Auth | JWT verified on every route |
| Storage | Cloudflare R2 | Free 10GB, zero egress cost |
| LLM (free tier) | Qwen3 32B via OpenRouter | For caption/content generation |
| LLM (paid tier) | Claude Sonnet via Vercel AI SDK | For higher quality output |
| Image generation | MuAPI via Provider Adapter | Flux Dev model, V1 |
| Analytics | PostHog | Free tier |

---

## The Two Tables That Exist (V1)

**`characters`** — One row per AI character. Contains the Digital DNA:
- Identity fields: name, domain, gender, age_range, nationality, style_preset
- Assembled fields: system_prompt, visual_style_prompt, prompt_dna (JSON)
- Reference images: reference_image_urls (JSON array of R2 paths)
- Status flags: dna_ready, reference_images_ready, is_active

**`generations`** — One row per piece of generated content:
- Links to character and user
- generation_type: "text" or "image"
- platform: "instagram" | "linkedin" | "x" | "carousel" | "story" | "general"
- text_output: the caption (for text generations)
- image_url: R2 path (for image generations)
- status: "pending" | "generating" | "completed" | "failed"

**No other tables exist. Do not create new tables without explicit instruction.**

---

## The Six V1 Flows (Everything Else Is Out of Scope)

1. Create Character (Digital DNA form)
2. Upload Reference Image (to R2)
3. Open Chat Studio
4. Generate Social Post (caption + image together)
5. Asset Library (browse, download, reuse)
6. Multi-Character Dashboard

---

## Architecture Constraints

**The Provider Adapter is sacred.**
Business logic never calls MuAPI, FAL, or any provider directly.
The only valid call: `getProvider('image').generateImage(prompt, options)`

**One Worker.**
There is one Cloudflare Worker named `personalityos-api`. There are no other Workers in V1.

**Supabase is the only database.**
No D1. No Redis. No second database of any kind.

**JWT first, always.**
Every `/api/*` route verifies the Supabase JWT before touching data.
`user_id` always comes from the verified JWT. Never from request body.

**R2 paths are permanent.**
Never delete R2 objects for active users. The asset library is permanent by design.

---

## Forbidden Actions in V1

Do not suggest or implement any of the following. Write them to BACKLOG.md instead.

| Forbidden | Reason |
|---|---|
| Voice/audio components, tables, or routes | V3 feature |
| Video generation | V2 feature |
| Direct social media posting (Instagram OAuth, etc.) | V2 feature |
| Payments or Stripe integration | After 50 paying users |
| Knowledge upload (PDF, notes, RAG pipeline) | Not validated for V1 |
| pgvector or vector extensions | No knowledge base in V1 |
| D1 database | Supabase is sufficient |
| Multiple Cloudflare Workers | One Worker handles everything |
| Template catalog or marketplace | V3/V4 features |
| Mobile app | V3 feature |
| Team/collaboration features | V4 feature |

---

## Design System

Every UI component uses this system. No exceptions.

```
Background: #0a0a0a
Surface:    #141414
Border:     #262626

Text primary:   #ffffff
Text secondary: #a1a1aa
Text muted:     #71717a

Accent (primary actions): #6366f1 (indigo)
Success: #22c55e
Error:   #ef4444

Components: shadcn/ui only — no custom component libraries
No inline style={{}} — Tailwind classes only
```

---

## Branch Rules (Read Before Touching Git)

- You work only on `feature/*` branches
- You never commit directly to `develop` or `main`
- Every commit goes through a Pull Request that the founder reviews
- The founder runs `git add` and `git commit` — never Claude Code

---

## How to Handle Scope Creep

If the founder asks for something not in the current phase:
1. Do not refuse — acknowledge it is a good idea
2. Say: "This is a [V2/V3/V4] feature. I will add it to BACKLOG.md."
3. Write it to `docs/BACKLOG.md` with a one-sentence description
4. Return to the current task

Example:
```
Founder: "Can we add a feature where users can schedule their posts?"
Claude: "That's a solid V2 feature — it's outside V1 scope but I've noted it in BACKLOG.md.
         Back to the asset library we were building: shall we continue with the download button?"
```

---

## Environment Variables Claude Must Know About

Claude Code never sets these values. The founder sets them in `.env.local` (frontend) and `.dev.vars` (Worker).

But Claude Code must know they exist and reference them correctly in code:

**Frontend (`.env.local`):**
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon (public) key
- `NEXT_PUBLIC_WORKER_URL` — Worker URL (localhost:8787 in dev)

**Worker (`.dev.vars`):**
- `SUPABASE_URL` — same URL, for Worker use
- `SUPABASE_ANON_KEY` — for auth verification
- `SUPABASE_SERVICE_KEY` — for admin operations
- `ANTHROPIC_API_KEY` — Claude API
- `OPENROUTER_API_KEY` — Qwen via OpenRouter
- `MUAPI_API_KEY` — image generation
- `LLM_PROVIDER` — "openrouter" or "anthropic"

---

## What a Good Session Looks Like

```
Start: Read docs → confirm understanding → state task in two sentences
Work:  One piece at a time → explain before next piece
Test:  Suggest testing in browser after each working unit
Commit: Suggest commit message after each working change
End:   Summarise what was built, what is NOT finished, and tomorrow's first task
```

---

## What the Founder Needs From You

The founder is a Mechanical Engineer with no software background. They are intelligent and learn fast, but need:
- Technical terms explained in plain English the first time they appear
- Analogies to physical systems or manufacturing processes
- Explicit step-by-step instructions for terminal commands
- Explanations of *why* before *how*
- Warning before any action that cannot be undone

Never say "just do X." Always say "Do X because Y."
