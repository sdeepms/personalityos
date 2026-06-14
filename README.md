# PersonalityOS — Own Your AI Identity

Create persistent AI characters that generate consistent content across every platform. One face. One voice. Infinite content.

## What It Does

PersonalityOS is a Digital Identity OS for content creators. You create an AI character once — give it a name, a domain, a communication style, and a reference photo. From that point, every caption and image it generates stays in that character's face and voice, forever.

No re-uploading. No re-explaining. Just open chat and generate.

## Live Demo

https://personalityos-d1x.pages.dev

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16, TypeScript, Tailwind CSS, shadcn/ui |
| Backend | Cloudflare Workers + Hono |
| Database | Supabase PostgreSQL |
| Storage | Cloudflare R2 |
| Auth | Supabase Auth (Email + Google + GitHub) |
| LLM | Qwen3 32B via OpenRouter (default), Claude Sonnet (paid) |
| Image Generation | MuAPI — nano-banana-edit + flux-dev |
| Deployment | Cloudflare Pages (frontend) + Cloudflare Workers (backend) |

## Key Architecture Decisions

- **One Worker, Hono router** — single Cloudflare Worker handles all API routes
- **Provider Adapter** — image generation never calls MuAPI directly; always through an adapter layer so providers can be swapped without code changes
- **Prompt DNA** — each character stores assembled prompt modifiers, style preferences, and negative prompts as a JSON field; deterministic prompt assembly means Tuesday's Arjun looks like Thursday's Arjun
- **Supabase only** — one database, no D1, no Redis, no second database
- **Assets over interactions** — every generation saves to the library automatically

## Running Locally

```bash
# Clone
git clone https://github.com/sdeepms/personalityos
cd personalityos

# Install dependencies
npm install

# Set environment variables
cp .env.local.example .env.local
# Fill in: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, 
#          NEXT_PUBLIC_WORKER_URL

# Start frontend
npm run dev

# Start Worker (separate terminal)
cd workers/api
cp .dev.vars.example .dev.vars
# Fill in all API keys
wrangler dev --local
```

Frontend: http://localhost:3000
Worker: http://localhost:8787

## Project Structure

```
personalityos/
├── app/                    # Next.js pages
│   ├── (auth)/             # Login, signup
│   └── dashboard/          # Chat, library, settings, create
├── workers/api/src/
│   ├── routes/             # characters, chat, generate, library
│   ├── providers/          # Provider Adapter (MuAPI, FAL stub, LLM)
│   └── services/           # DNA assembler, prompt builder
├── docs/                   # Architecture documents
└── agents/                 # Claude Code agent specifications
```

## Roadmap

| Version | Focus |
|---|---|
| V1 (current) | Character creation, image + caption generation, asset library |
| V1.5 | Direct social posting, better face consistency |
| V2 | Video generation (Kling/Runway adapters) |
| V3 | Voice DNA (ElevenLabs), template catalog |
| V4 | Creator marketplace |

## Infrastructure Cost

~₹2,000/month at 100 users. Free tier covers database, storage, and hosting.

---

Built by a solo founder in 4 days.
