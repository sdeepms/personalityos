# PersonalityOS — System Architecture (V1)

**Version:** 1.0 Final
**Stack:** Next.js + Hono + Supabase + R2 + OpenRouter + MuAPI
**Last Updated:** June 2026

---

## The Full System Map

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BROWSER                                       │
│                  Next.js 14 — Cloudflare Pages (free)               │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐   │
│  │  Identity Studio │  │   Chat Studio    │  │  Asset Library   │   │
│  │  Create character│  │  Platform shorts │  │  Browse history  │   │
│  │  Upload photos   │  │  Caption + Image │  │  Download assets │   │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘   │
│           │                     │                     │             │
│  shadcn/ui · Tailwind CSS · Vercel AI SDK (streaming) │             │
└───────────┼─────────────────────┼─────────────────────┼─────────────┘
            │    HTTPS + JWT      │                     │
            ▼                     ▼                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│              CLOUDFLARE WORKER — Hono Router                        │
│                   Single deployment · free tier                     │
│                                                                      │
│  Auth middleware → Supabase JWT verify → extract user_id            │
│                                                                      │
│  /api/characters/*  →  CharacterService                             │
│      DNA assembly · CRUD · reference image management               │
│                                                                      │
│  /api/chat          →  ChatService                                  │
│      LLM call · structured JSON response · platform formatting      │
│          └── LLMAdapter → Qwen3 32B (free) / Claude (paid)         │
│                                                                      │
│  /api/generate/*    →  GenerationService                            │
│      Prompt DNA assembly · image generation · R2 storage           │
│          └── ProviderAdapter → generateImage()                      │
│                   ├── MuAPIAdapter (V1 active)                      │
│                   │     models.ts ← from Open Gen AI models.js      │
│                   │     polling  ← from Open Gen AI muapi.js        │
│                   └── FALAdapter (V2 stub)                          │
│                                                                      │
│  /api/library/*     →  LibraryService                               │
│      Fetch generations · paginate · filter by type/platform        │
└────────────┬────────────────────┬────────────────────┬──────────────┘
             │                    │                    │
             ▼                    ▼                    ▼
┌────────────────────┐  ┌──────────────────┐  ┌────────────────────┐
│  SUPABASE          │  │  CLOUDFLARE R2   │  │  AI PROVIDERS      │
│                    │  │                  │  │                    │
│  Auth (JWT)        │  │  identity/       │  │  OpenRouter        │
│  characters table  │  │  generations/    │  │  └─ Qwen3 32B      │
│  generations table │  │                  │  │     free users     │
│  Free 500MB        │  │  Free 10GB       │  │                    │
│                    │  │  Zero egress     │  │  Anthropic         │
└────────────────────┘  └──────────────────┘  │  └─ Claude Sonnet  │
                                               │     paid users     │
                                               │                    │
                                               │  MuAPI             │
                                               │  └─ Flux Dev V1    │
                                               │  └─ 200+ models    │
                                               │                    │
                                               │  FAL.ai (V2)       │
                                               │  └─ Flux realtime  │
                                               └────────────────────┘
```

---

## Why One Worker With Hono

One Worker. Four route modules. One `wrangler.toml`. One set of secrets. One log stream.

The previous architecture had three Workers. Each needed its own deployment, its own secrets configuration, its own CORS setup. When something broke, you checked three places.

Hono is a lightweight HTTP framework that runs inside a Cloudflare Worker. It handles routing, middleware chaining, and TypeScript types. It adds no meaningful overhead. It makes the Worker read and behave like a proper API server.

There is no valid reason to split into multiple Workers at V1 scale.

---

## The Provider Adapter — The Non-Negotiable Rule

```
Business logic NEVER calls MuAPI, FAL, or any provider directly.
Business logic ONLY calls:  adapter.generateImage(prompt, options)
```

Today: MuAPI.
Tomorrow: FAL (faster, same interface).
Future: Any provider that launches.

Switching providers = one database row update. Zero code changes.

### File Structure

```
workers/api/src/providers/
├── interface.ts         ← GenerationProvider contract
├── factory.ts           ← reads provider_config, returns adapter
├── models.ts            ← adapted from Open Gen AI models.js
├── image/
│   ├── muapi.ts         ← V1 active — uses models.ts + muapi.js pattern
│   └── fal.ts           ← V2 stub — throw "not yet active"
└── text/
    ├── openrouter.ts    ← free users + all planning stages
    └── anthropic.ts     ← paid users script writing
```

### The Interface

```typescript
interface GenerationProvider {
  name: string;

  generateImage(
    prompt: string,
    options: ImageOptions
  ): Promise<GenerationResult>;

  // V2: generateVideo()
  // V3: generateAudio()
}

interface ImageOptions {
  referenceImageUrls?: string[];  // R2 paths to character reference images
  aspectRatio: string;            // "1:1" | "9:16" | "16:9" | "4:5"
  negativePrompt?: string;        // from prompt_dna
  model?: string;                 // from prompt_dna.provider_overrides
}

interface GenerationResult {
  outputUrl: string;    // R2 path after download + re-upload
  provider: string;
  model: string;
  durationMs: number;
  costUsdCents: number;
}
```

### Open Generative AI Integration

From the open-source repo (MIT license, 18,500+ stars) we extract two things:

**`models.js` → `providers/models.ts`**
The complete catalog of 200+ MuAPI-compatible models: name, endpoint, parameters, default values. This is the source of truth for which Flux model to use, what parameters it accepts, and how to structure the request. We convert it to TypeScript and maintain our own copy.

**`muapi.js` → reference for `providers/image/muapi.ts`**
The submit-and-poll pattern. MuAPI is async — you POST a job, receive a `request_id`, then poll GET until the job is complete. This pattern is non-trivial to implement correctly (timeout handling, error states, backoff). The open-source version is battle-tested by 18,500 users. We adapt it, not reinvent it.

What we do NOT use from the repo:
- `app/` routes — we have our own Next.js structure
- `ApiKeyModal.js` — API keys are Worker secrets, never browser localStorage
- `electron/` — web-only
- `components/StandaloneShell.js` — we use shadcn/ui

The MuAPI adapter also adds one step the open-source version skips:
After getting the image URL from MuAPI, download the image and re-upload to our R2 bucket. MuAPI CDN URLs expire. R2 URLs are permanent. The asset library requires permanent URLs.

---

## The LLM Strategy — Cost-Efficient Quality

Two providers. One adapter interface.

**Free users → Qwen3 32B via OpenRouter**
Qwen3 32B is the strongest open-source model for multilingual content, Indian context, and structured JSON output. OpenRouter provides access at very low cost with a free tier. For caption writing and content planning, it is within 10–15% of Claude quality at 10× lower cost.

**Paid users → Claude Sonnet via Vercel AI SDK**
When users pay, they get the highest-quality output. Claude's structured JSON reliability is better than Qwen3's for the caption format requirements.

**The switch:** One row in a future `provider_config` table. For V1, the provider is hardcoded in the Worker environment variable: `LLM_PROVIDER=openrouter` or `LLM_PROVIDER=anthropic`. Switching tiers later requires adding this table.

**Why Vercel AI SDK?**
It handles streaming (user sees caption appearing word by word), works in Cloudflare Workers edge environment, and provides a clean provider-agnostic interface. If we add GPT-4 later, it is one adapter addition.

---

## The Prompt DNA Assembly

This is how a character's DNA fields become a generation-ready image prompt. The Worker runs this on every image generation request.

```typescript
function assembleImagePrompt(
  character: Character,
  userDescription: string,
  platform: string
): AssembledPrompt {

  const dna = JSON.parse(character.prompt_dna);

  const positivePrompt = [
    userDescription,
    character.visual_style_prompt,
    ...dna.style_modifiers,
    dna.color_palette
  ].filter(Boolean).join(', ');

  return {
    prompt: positivePrompt,
    negative_prompt: dna.negative_prompt,
    aspect_ratio: dna.aspect_preferences[platform] ?? '1:1',
    reference_image_urls: JSON.parse(character.reference_image_urls)
      .filter(img => img.is_primary)
      .map(img => img.url),
    model: dna.provider_overrides?.muapi?.model ?? 'flux-dev'
  };
}
```

This function is deterministic. The same character always produces the same prompt structure. That is what makes Tuesday's Arjun look like Thursday's Arjun.

---

## The Chat Response Structure

The chat endpoint does not return a raw stream of words. It returns structured JSON that the frontend parses into distinct UI blocks.

**Request:**
```typescript
POST /api/chat
{
  character_id: "char_abc123",
  message: "Create an Instagram post about Emergency Provisions",
  platform: "instagram"
}
```

**LLM system prompt (assembled from character DNA):**
```
You are {character.name}, {character.domain}.
{character.system_prompt}

TASK: Generate content for the user's request.

PLATFORM: {platform}
FORMAT RULES FOR INSTAGRAM:
- Caption: 150-220 words
- Hook as first line (creates curiosity or makes a bold claim)
- 1-2 emojis used naturally
- 5-7 hashtags at the very end
- Ends with a question or call to action
- Conversational, first-person voice

ALWAYS respond with valid JSON only. No other text. No markdown.
Schema:
{
  "caption": "string — the full Instagram caption",
  "image_description": "string — one sentence describing what image should show",
  "platform": "string — the platform this is formatted for",
  "hashtags": ["string", "string"]
}
```

**Response from LLM:**
```json
{
  "caption": "The President can declare a National Emergency under Article 352...",
  "image_description": "Arjun standing at a whiteboard explaining constitutional emergency provisions with a serious but approachable expression",
  "platform": "instagram",
  "hashtags": ["#UPSC2025", "#IndianPolity", "#ConstitutionOfIndia", "#UPSCPrep", "#PolityNotes"]
}
```

**Worker then:**
1. Returns the JSON to frontend immediately (~3–5 seconds)
2. Frontend displays caption right away
3. Frontend triggers `POST /api/generate/image` with `image_description` and `platform`
4. Image generates in parallel (~15–25 seconds)
5. Frontend updates image slot when URL is returned

Caption and image generation are parallel. User reads the caption while the image generates. Total perceived wait: ~20 seconds for both.

---

## Key Data Flows

### Create Character Flow
```
User submits DNA form
      │
      ▼
POST /api/characters
  1. Verify JWT → extract user_id
  2. Validate required fields
  3. Assemble system_prompt from fields
  4. Assemble visual_style_prompt from fields
  5. Build default prompt_dna JSON
  6. INSERT into Supabase characters table
  7. Set dna_ready = 1
  8. Return character record
      │
      ▼
Frontend shows character card
Prompts: "Upload a reference photo"
```

### Generate Post Flow
```
User selects platform → types topic → sends
      │
      ▼
POST /api/chat
  1. Verify JWT
  2. Fetch character from Supabase
  3. Build LLM prompt (system + platform rules)
  4. Call LLMAdapter.generateText()
  5. Parse JSON response
  6. Return {caption, image_description, platform, hashtags}
      │
      ▼                        │
Frontend shows caption    Frontend calls simultaneously:
immediately (~4s)         POST /api/generate/image
                               │
                               ▼
                          1. Fetch character (prompt_dna, references)
                          2. Assemble full image prompt
                          3. getProvider('image') → MuAPIAdapter
                          4. MuAPIAdapter.generateImage()
                             a. Select model from models.ts catalog
                             b. POST to MuAPI → get request_id
                             c. Poll until complete (~15-25s)
                             d. Download image from MuAPI CDN
                             e. Upload to R2: generations/.../id.png
                          5. INSERT into Supabase generations (both text + image rows)
                          6. Return {image_url: "generations/..."}
                               │
                               ▼
                          Frontend replaces placeholder
                          with generated image (~20-25s total)
```

### Asset Library Flow
```
User opens Library tab for a character
      │
      ▼
GET /api/library?character_id=xxx&type=all&page=1
  1. Verify JWT
  2. Query Supabase:
     SELECT * FROM generations
     WHERE character_id = $1 AND user_id = $2
     ORDER BY created_at DESC
     LIMIT 20 OFFSET $3
  3. Return paginated results
      │
      ▼
Frontend renders cards:
  Text generations → caption preview + copy button
  Image generations → thumbnail + download button
```

---

## Authentication Flow

```
User logs in with email + password
      │
      ▼
Supabase Auth SDK (in browser) handles everything:
  - POST to Supabase Auth endpoint
  - Returns JWT access token + refresh token
  - Stores in browser (Supabase client library handles this)
      │
      ▼
Every API call includes:
  Authorization: Bearer {jwt_token}
      │
      ▼
Hono auth middleware (runs before every /api/* handler):
  1. Extract token from Authorization header
  2. Call supabase.auth.getUser(token)
  3. Valid → c.set('userId', user.id) + c.set('userEmail', user.email)
  4. Invalid → return 401 immediately
      │
      ▼
All route handlers read: const userId = c.get('userId')
All Supabase queries include: .eq('user_id', userId)
```

---

## Project Folder Structure

```
personalityos/
│
├── app/                              ← Next.js pages (Cloudflare Pages)
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── signup/page.tsx
│   └── dashboard/
│       ├── page.tsx                  ← Character grid dashboard
│       ├── create/page.tsx           ← DNA creation form
│       └── [characterId]/
│           ├── page.tsx              ← Redirects to /chat
│           ├── chat/page.tsx         ← Chat Studio (main view)
│           ├── library/page.tsx      ← Asset Library
│           └── settings/page.tsx     ← Edit DNA, prompt_dna controls
│
├── components/
│   ├── ui/                           ← shadcn/ui base components
│   ├── character/
│   │   ├── CharacterCard.tsx         ← Dashboard card
│   │   ├── DNAForm.tsx               ← Creation form with visual cards
│   │   └── ReferenceImageUpload.tsx  ← Photo upload component
│   ├── chat/
│   │   ├── ChatStudio.tsx            ← Main chat interface
│   │   ├── PlatformShortcuts.tsx     ← Shortcut buttons above input
│   │   ├── GenerationCard.tsx        ← Caption + image result card
│   │   └── ImagePlaceholder.tsx      ← Loading state during image gen
│   └── library/
│       ├── LibraryGrid.tsx           ← Asset grid view
│       └── AssetCard.tsx             ← Individual asset card
│
├── workers/
│   └── api/
│       ├── src/
│       │   ├── index.ts              ← Hono app entry point
│       │   ├── middleware/
│       │   │   └── auth.ts           ← JWT verification
│       │   ├── routes/
│       │   │   ├── characters.ts     ← CRUD + DNA assembly
│       │   │   ├── chat.ts           ← LLM structured response
│       │   │   ├── generate.ts       ← Image generation
│       │   │   └── library.ts        ← Asset retrieval
│       │   ├── providers/
│       │   │   ├── interface.ts      ← GenerationProvider contract
│       │   │   ├── factory.ts        ← Provider selection
│       │   │   ├── models.ts         ← From Open Gen AI models.js
│       │   │   ├── image/
│       │   │   │   ├── muapi.ts      ← Active V1 (models.ts + muapi.js)
│       │   │   │   └── fal.ts        ← V2 stub
│       │   │   └── text/
│       │   │       ├── openrouter.ts ← Qwen3 32B (free users)
│       │   │       └── anthropic.ts  ← Claude Sonnet (paid users)
│       │   └── services/
│       │       ├── dna-assembler.ts  ← system_prompt + prompt_dna builder
│       │       └── prompt-builder.ts ← image prompt assembly
│       └── wrangler.toml
│
├── docs/                             ← All architecture documents
├── agents/                           ← All agent specifications
└── package.json
```

---

## Environment Variables

| Variable | Stored In | Used By | Notes |
|---|---|---|---|
| `SUPABASE_URL` | Worker secret | Auth verify + DB queries | Never in frontend |
| `SUPABASE_ANON_KEY` | Worker secret | Auth.getUser() | Never in frontend |
| `SUPABASE_SERVICE_KEY` | Worker secret | Admin DB operations | Never exposed |
| `OPENROUTER_API_KEY` | Worker secret | LLM free tier | Never in frontend |
| `ANTHROPIC_API_KEY` | Worker secret | LLM paid tier | Never in frontend |
| `MUAPI_API_KEY` | Worker secret | Image generation | Never in frontend |
| `POSTHOG_API_KEY` | Worker secret | Backend events | Never in frontend |
| `NEXT_PUBLIC_SUPABASE_URL` | Pages env | Frontend auth | Public — safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Pages env | Frontend auth | Public — safe |
| `NEXT_PUBLIC_WORKER_URL` | Pages env | API calls | Public — safe |
| `NEXT_PUBLIC_POSTHOG_KEY` | Pages env | Frontend events | Public — safe |

---

## What Is Not Built in V1

| Component | Reason |
|---|---|
| Video generation routes | Phase 2 |
| Voice / audio routes | V3 |
| Payments / Stripe | After 50 paying users |
| Template catalog | V3 |
| Marketplace routes | V4 |
| RAG / knowledge pipeline | Not validated for V1 |
| pgvector / semantic search | No documents in V1 |
| D1 database | Supabase is sufficient and simpler |
| Multiple Cloudflare Workers | One Worker + Hono handles it |

---

## Version Migration Path

V1 → V2 (Video):
- Add `generateVideo()` to Provider interface
- Add Kling/Runway adapter
- Add `video_url` column to `generations` table
- Add Video shortcut to Chat Studio
- Zero changes to characters table or identity layer

V2 → V3 (Voice + Templates):
- Add `voice_profiles` table
- Add ElevenLabs/Cartesia adapter
- Add `templates` table with pre-built DNA configs
- Add template catalog page
- Characters table gains `voice_profile_id` FK

V3 → V4 (Marketplace):
- Add `marketplace_listings` and `purchases` tables
- Add Stripe webhook handler
- Characters table gains `is_published` flag
- Zero changes to generation flow

Each version adds to the identity layer. Nothing rebuilds it.
