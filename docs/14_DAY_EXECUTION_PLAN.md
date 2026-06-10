# PersonalityOS — 14-Day Execution Plan

**Version:** 1.0 Final — build fast, ship fast
**Goal:** Working V1 deployed and shared with first users by Day 14
**Last Updated:** June 2026

---

## The Rules

1. Never start Day N+1 before Day N passes its validation checklist.
2. Test in the browser after every meaningful change. If you haven't opened the browser in 30 minutes, stop and test.
3. Everything not in this plan goes to BACKLOG.md. Write it down, move on.
4. Commit at the end of every day. No exceptions.
5. Claude Code builds. You review, test, and approve. You are the architect.

---

## Phase Overview

```
Days 1–2   Foundation     Accounts · project · Supabase · auth
Days 3–5   Identity       Character creation · DNA assembly · reference images
Days 6–9   Generation     Chat · captions · image generation · Provider Adapter
Days 10–11 Library        Asset library · multi-character dashboard
Days 12–13 Deploy         Production deployment · end-to-end test
Day 14     Ship           Polish · README · first users
```

---

## Day 1 — Accounts, Tools, Project Skeleton

**Goal:** Every account created, every tool installed, project running locally.

### Morning — Create accounts

| Service | URL | What it does |
|---|---|---|
| GitHub | github.com | Code storage, deployment trigger |
| Cloudflare | cloudflare.com | Worker, Pages, R2 |
| Supabase | supabase.com | Database + Auth |
| Anthropic | console.anthropic.com | Claude API — add ₹500 credit |
| OpenRouter | openrouter.ai | Qwen3 32B — add ₹500 credit |
| MuAPI | muapi.ai | Image generation — add ₹1000 credit |
| PostHog | posthog.com | Analytics — free tier |

Save every credential in a password manager.

### Afternoon — Install tools

```bash
# Node.js 18+ from nodejs.org
node --version    # must show 18+

# Claude Code
npm install -g @anthropic-ai/claude-code
claude            # authenticate

# Wrangler (Cloudflare CLI)
npm install -g wrangler
wrangler login

# VS Code from code.visualstudio.com
# Extensions: ESLint, Tailwind CSS IntelliSense, GitLens
```

### Evening — Create project

Create GitHub repo: `personalityos` — Private — no README init.

```bash
cd ~/Documents && mkdir Projects && cd Projects
claude
```

**Claude Prompt — Day 1:**
```
I am building PersonalityOS — a Digital Identity OS for AI content creation.

Stack:
- Frontend: Next.js 14, TypeScript, Tailwind CSS, shadcn/ui
- Backend: Cloudflare Workers + Hono
- Database: Supabase PostgreSQL only (no D1, no pgvector)
- Storage: Cloudflare R2
- Auth: Supabase Auth
- AI Text: Vercel AI SDK (Anthropic + OpenRouter)
- AI Image: MuAPI via Provider Adapter

Please:
1. Create Next.js 14 project named personalityos
   (TypeScript, Tailwind, App Router, no src/, alias @/*)
2. Run: npx shadcn@latest init (dark theme, default config)
3. Create folder: workers/api/src/
4. Create workers/api/wrangler.toml for Worker named "personalityos-api"
5. Install in workers/api: hono @hono/zod-validator zod
6. Create workers/api/src/index.ts — Hono app, GET /health returns {"status":"ok"}
7. Create .gitignore (include: .env.local .dev.vars node_modules/ .next/ .wrangler/)
8. Create docs/ and agents/ folders
9. git init, first commit "Initial project setup"
10. Show commands to connect to GitHub

GitHub username: [YOUR USERNAME]
```

**Validation checklist:**
- [ ] `node --version` → 18+
- [ ] `npm run dev` → localhost:3000 shows Next.js default
- [ ] `cd workers/api && wrangler dev` → localhost:8787/health returns `{"status":"ok"}`
- [ ] Code pushed to GitHub

---

## Day 2 — Supabase Setup + Auth

**Goal:** Database tables created. Users can sign up and log in. All routes protected.

### Morning — Supabase project

1. supabase.com → New Project
   - Name: personalityos
   - Region: Southeast Asia (Singapore)
   - Strong password → save it

2. Settings → API → copy and save:
   - Project URL → `SUPABASE_URL`
   - anon public key → `SUPABASE_ANON_KEY`
   - service_role key → `SUPABASE_SERVICE_KEY`

3. SQL Editor → run the complete migration from DATABASE_SCHEMA.md

### Afternoon — Environment + auth

Create `.env.local` in project root:
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_WORKER_URL=http://localhost:8787
```

Create `workers/api/.dev.vars`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key
ANTHROPIC_API_KEY=your-key
OPENROUTER_API_KEY=your-key
MUAPI_API_KEY=your-key
```

Verify both files are in `.gitignore`.

**Claude Prompt — Day 2:**
```
I am building PersonalityOS. Supabase project is set up.
The SQL migration from DATABASE_SCHEMA.md has been run.
Two tables exist: characters, generations.

Please build:

1. Supabase Auth pages:
   - app/(auth)/login/page.tsx — email + password, dark theme, shadcn/ui
   - app/(auth)/signup/page.tsx — email + password + confirm password
   - On login success: redirect to /dashboard
   - On signup success: redirect to /login with "Check your email" message

2. middleware.ts in project root:
   - Unauthenticated /dashboard/* → redirect to /login
   - Authenticated /login or /signup → redirect to /dashboard
   - Use @supabase/ssr

3. Hono auth middleware at workers/api/src/middleware/auth.ts:
   - Reads Authorization header: Bearer {jwt}
   - Calls supabase.auth.getUser(token)
   - Valid: c.set('userId', user.id)
   - Invalid: return 401 JSON {"error":"Unauthorized"}
   - Apply to all /api/* routes

4. Route stubs in workers/api/src/index.ts:
   - /api/characters/* → stub: {"message":"characters coming soon"}
   - /api/chat → stub
   - /api/generate/* → stub
   - /api/library/* → stub

5. Dashboard placeholder at app/dashboard/page.tsx:
   - Shows logged-in user email
   - Sign Out button
   - Dark theme

Install: @supabase/ssr @supabase/supabase-js
```

**Validation checklist:**
- [ ] Supabase SQL Editor: `SELECT * FROM characters` → runs without error
- [ ] localhost:3000 → redirects to /login
- [ ] Signup creates user (Supabase → Authentication → Users)
- [ ] Login → reaches /dashboard
- [ ] Sign Out → back to /login
- [ ] Worker: GET localhost:8787/api/characters with no token → 401
- [ ] Commit: "Add Supabase schema, auth pages, auth middleware"

---

## Day 3 — Character Creation Form

**Goal:** Users can fill the DNA form and create a character. Character appears in dashboard.

**Claude Prompt — Day 3:**
```
Build the character creation flow for PersonalityOS.

Read:
- docs/MVP_SCOPE.md (Flow 1: Create Character)
- docs/DATABASE_SCHEMA.md (Table 1: characters)
- docs/SYSTEM_ARCHITECTURE.md (services/dna-assembler.ts section)

Backend: workers/api/src/routes/characters.ts

POST /api/characters
Body: { name, domain, gender, age_range, nationality, style_preset }

Logic:
1. Verify JWT → get user_id
2. Validate: name and domain are required
3. Assemble system_prompt from fields:
   "You are {name}, an expert in {domain}. You are a {gender} in your {age_range}.
    You are {nationality}. Your communication style is {style_preset_description}.
    [style_preset descriptions:
      academic_accessible: You are formal, precise, and structured. You explain
        complex topics with clarity and academic rigor.
      engaging_explainer: You are conversational and approachable. You use
        examples, analogies, and real-world connections to make ideas accessible.
      direct_mentor: You are authoritative and direct. You give clear guidance
        without unnecessary elaboration.]"
4. Assemble visual_style_prompt:
   "{nationality} {gender}, {age_range}, professional {domain} expert,
    natural lighting, high quality portrait"
5. Build default prompt_dna JSON:
   {
     style_modifiers: ["professional portrait photography", "cinematic lighting", "sharp focus", "high detail"],
     negative_prompt: "cartoon, anime, blurry, low quality, deformed, extra limbs, watermark, text overlay",
     color_palette: "professional, warm tones",
     aspect_preferences: { instagram:"1:1", linkedin:"4:5", x:"16:9", story:"9:16", reel:"9:16", carousel:"1:1" },
     provider_overrides: { muapi: { model:"flux-dev", steps:28 } }
   }
6. INSERT into characters table
7. Set dna_ready = 1
8. Return created character

GET /api/characters
Returns all active characters for the logged-in user.

GET /api/characters/:id
Returns one character (verify ownership).

PUT /api/characters/:id
Updates character fields, regenerates system_prompt and visual_style_prompt.

Frontend:

app/dashboard/create/page.tsx — visual card-based DNA form:
Section 1: Character name (text input)
Section 2: Domain (text input + quick-select chips below:
  UPSC / Finance / Startup / Coaching / History / Ethics / Science / Law / Other)
Section 3: Three column card grid for Gender: Male | Female | Neutral
Section 4: Three column card grid for Age: 20s | 30s | 40s+
Section 5: Nationality cards: Indian + "Other" with text input
Section 6: Style preset — three large cards with name + description:
  Engaging Explainer (selected by default)
  Academic Accessible
  Direct Mentor

Submit → POST /api/characters → redirect to /dashboard/[characterId]/chat

app/dashboard/page.tsx — update to show character cards:
Each card: character name (large), domain (smaller), "Open Chat" button
"Create New Character" button prominent at top
Empty state: illustration + "Create your first character" CTA

Dark theme throughout. Use shadcn/ui Card, Button, Input, Badge.
```

**Validation checklist:**
- [ ] DNA form renders with visual cards (not dropdowns)
- [ ] Submitting creates a character in Supabase (check Table Editor)
- [ ] system_prompt is populated in the DB row
- [ ] Character card appears on dashboard
- [ ] Commit: "Add character creation form and DNA assembly"

---

## Day 4 — Reference Image Upload

**Goal:** Users can upload reference photos. Photos stored in R2. Character is visually ready.

**Claude Prompt — Day 4:**
```
Build reference image upload for PersonalityOS.

Read: docs/MVP_SCOPE.md (Flow 2: Upload Reference Image)
Read: docs/DATABASE_SCHEMA.md (R2 storage paths section)

Backend: add to workers/api/src/routes/characters.ts

POST /api/characters/:id/references
- Accepts multipart form data: files (images) + pose_types (JSON array of labels)
- pose_type values: "front" | "side" | "angled" | "backside" | "expertise_specific" | "other"
- Validate: only image/jpeg and image/png, max 10MB per file
- For each file:
  - Upload to R2 at: identity/{userId}/{characterId}/ref_{timestamp}_{poseType}.jpg
  - Build reference object: { url, pose_type, is_primary }
  - First "front" image (or first image if no front) gets is_primary: true
- Update characters.reference_image_urls JSON array in Supabase
- Set characters.reference_images_ready = 1
- Return updated character

GET /api/characters/:id/references
- Return parsed reference_image_urls array
- Include public R2 URLs (configure R2 bucket to allow public read)

Add R2 binding to wrangler.toml:
[[r2_buckets]]
binding = "STORAGE"
bucket_name = "personalityos-storage"

Frontend: app/dashboard/[characterId]/settings/page.tsx

Reference Image Upload section:
- Drag-and-drop upload area (accepts multiple files)
- Each uploaded photo gets a pose label dropdown below it:
  Front Portrait | Side Profile | Angled | Backside | Expertise Specific | Other
- Minimum required: 1 photo (show validation message if none)
- Shows: "Tip: Upload a front portrait for best consistency"
- After upload: shows thumbnails with pose labels
- "Save Reference Images" button

After successful save:
- Show: "Arjun's visual identity is ready ✓"
- Show thumbnails of uploaded images
- Character card on dashboard now shows primary reference image

Also add R2 bucket creation to Day 1 instructions:
Run: wrangler r2 bucket create personalityos-storage
```

**Validation checklist:**
- [ ] Upload a photo → appears in R2 dashboard under identity/ path
- [ ] character.reference_images_ready = 1 in Supabase
- [ ] character.reference_image_urls has correct JSON structure
- [ ] Character card on dashboard shows the uploaded photo as thumbnail
- [ ] Commit: "Add reference image upload to R2"

---

## Day 5 — Provider Adapter + MuAPI Integration

**Goal:** The Provider Adapter is wired. MuAPI generates images. Results stored in R2.

**Claude Prompt — Day 5:**
```
Build the Provider Adapter and MuAPI image generation for PersonalityOS.

Read:
- docs/SYSTEM_ARCHITECTURE.md (Provider Adapter section)
- docs/README_ANALYSIS.md (section 9: Reusability Analysis — models.js and muapi.js)

The open-source repo (github.com/Anil-matcha/Open-Generative-AI) has two files
we are adapting. Please look at their structure on GitHub before building:
- packages/studio/src/models.js (model catalog pattern)
- packages/studio/src/muapi.js (submit-and-poll pattern)

Build these files in workers/api/src/providers/:

1. interface.ts
   GenerationProvider interface with:
   - generateImage(prompt, options): Promise<GenerationResult>
   ImageOptions: { referenceImageUrls?, aspectRatio, negativePrompt?, model? }
   GenerationResult: { outputUrl, provider, model, durationMs, costUsdCents }

2. models.ts
   Adapted from Open Gen AI models.js:
   - TypeScript conversion
   - Filter to image generation models only
   - Export: MODELS array, getModelById(id), getDefaultModel()
   Default model: "flux-dev"
   Fast model: "flux-schnell" (faster, lower quality)

3. image/muapi.ts
   MuAPIAdapter implementing GenerationProvider:
   - generateImage():
     a. Select model from MODELS catalog
     b. Build MuAPI request body (prompt, negative_prompt, width, height from aspect_ratio)
     c. POST to MuAPI submission endpoint → get request_id
     d. Poll every 3 seconds: GET status endpoint
     e. Max 90 seconds timeout (throw error if exceeded)
     f. On complete: download image binary from result URL
     g. Upload binary to R2: generations/{userId}/{characterId}/{nanoid()}.png
     h. Return R2 path as outputUrl
   - generateVideo(): throw new Error("MuAPI video not active in V1")
   Width/height from aspect_ratio:
     "1:1" → 1024×1024
     "9:16" → 832×1216
     "16:9" → 1216×832
     "4:5" → 912×1136

4. factory.ts
   getImageProvider(): returns MuAPIAdapter
   (hardcoded for V1; will read DB config in V2)

5. image/fal.ts
   Stub: constructor logs "FAL not active"; generateImage throws Error.

Test endpoint in workers/api/src/routes/generate.ts:
POST /api/generate/test
Body: { prompt: string }
(No auth required — for testing only, remove before production)
- Calls MuAPIAdapter.generateImage(prompt, {aspectRatio:"1:1"})
- Returns { outputUrl }

Use environment variable MUAPI_API_KEY from .dev.vars.
Use R2 binding STORAGE for uploads.
```

**Validation checklist:**
- [ ] POST localhost:8787/api/generate/test with `{"prompt":"a professional portrait of a person"}` → returns an image URL within 30 seconds
- [ ] Image is accessible at the R2 URL
- [ ] Image appears in Cloudflare R2 dashboard under generations/
- [ ] FAL adapter stub throws correctly (doesn't crash the Worker)
- [ ] Commit: "Add Provider Adapter, MuAPI integration, R2 image storage"

---

## Day 6 — LLM Adapter + Chat Endpoint

**Goal:** The chat endpoint returns structured captions. Qwen3 32B is the default. Claude is the alternative.

**Claude Prompt — Day 6:**
```
Build the LLM adapters and chat endpoint for PersonalityOS.

Read:
- docs/SYSTEM_ARCHITECTURE.md (Chat Response Structure section)
- docs/MVP_SCOPE.md (Flow 4: Generate Social Post — platform formatting rules)

Build in workers/api/src/providers/text/:

1. openrouter.ts
   - OpenRouter API call using Vercel AI SDK
   - Model: "qwen/qwen3-32b"
   - generateText(systemPrompt, userPrompt, responseFormat):
     If responseFormat = "json": add "Respond with valid JSON only." to system prompt
     Call OpenRouter API endpoint with model and messages
     Return parsed JSON (parse carefully — strip ```json fences if present)
   - Use OPENROUTER_API_KEY from environment

2. anthropic.ts
   - Anthropic API call using Vercel AI SDK
   - Model: "claude-sonnet-4-5"
   - Same interface as openrouter.ts
   - Use ANTHROPIC_API_KEY from environment

Build workers/api/src/routes/chat.ts:

POST /api/chat
Body: { character_id, message, platform }
platform values: "instagram" | "linkedin" | "x" | "carousel" | "story" | "general"

Logic:
1. Verify JWT → get user_id
2. Verify user owns character_id
3. Fetch character from Supabase (system_prompt, visual_style_prompt, prompt_dna)
4. Build platform format rules based on platform value:
   instagram: "Caption 150-220 words, hook first line, 1-2 emojis naturally, 5-7 hashtags at end, ends with question"
   linkedin:  "Caption 200-400 words, strong opinion as first line, no hashtags in body, 3-5 hashtags at very end, professional personal tone"
   x:         "Thread of 5-7 tweets, each under 280 chars, numbered 1/7, hook on tweet 1, CTA on final tweet. caption field contains all tweets separated by newlines"
   carousel:  "5-7 slide captions, each one punchy sentence, builds on previous. caption field contains all slides separated by ---"
   story:     "50-80 words, single clear point, very punchy. One emoji maximum."
   general:   "200-300 words, natural and engaging"

5. Build LLM system prompt:
   "{character.system_prompt}

   PLATFORM: {platform}
   FORMAT RULES: {platform_format_rules}

   Always respond with valid JSON only. No markdown. No other text.
   Schema:
   {
     caption: string,
     image_description: string (one sentence scene description featuring the character),
     platform: string,
     hashtags: array of strings
   }"

6. Determine LLM provider:
   Read env var LLM_PROVIDER (default: "openrouter")
   "openrouter" → OpenRouter adapter
   "anthropic" → Anthropic adapter

7. Call adapter.generateText(systemPrompt, message, "json")
8. Parse and validate JSON response
9. Save text generation to Supabase generations table:
   { character_id, user_id, generation_type:"text", platform, user_prompt:message,
     text_output:caption, provider:llm_provider, model_used, generation_time_ms }
10. Return { caption, image_description, platform, hashtags, generation_id }

Add to .dev.vars:
LLM_PROVIDER=openrouter
```

**Validation checklist:**
- [ ] POST /api/chat with `{"character_id":"xxx","message":"Create an Instagram post about motivation","platform":"instagram"}` → returns valid JSON with caption and image_description
- [ ] caption is in the character's voice (not generic AI)
- [ ] caption length matches platform rules
- [ ] generation saved in Supabase generations table
- [ ] Changing LLM_PROVIDER to "anthropic" switches the model
- [ ] Commit: "Add LLM adapters and structured chat endpoint"

---

## Day 7 — Prompt DNA Assembly + Full Image Generation

**Goal:** Image generation uses character DNA. Generated images show consistent character appearance.

**Claude Prompt — Day 7:**
```
Build the full image generation endpoint with Prompt DNA assembly for PersonalityOS.

Read:
- docs/SYSTEM_ARCHITECTURE.md (Prompt DNA Assembly section + Generate Post Flow)
- docs/MVP_SCOPE.md (Prompt DNA section with the JSON structure)

Build workers/api/src/services/prompt-builder.ts:

function assembleImagePrompt(character, userDescription, platform):
  1. Parse character.prompt_dna JSON
  2. Parse character.reference_image_urls JSON → get primary reference URL
  3. Assemble positive prompt:
     [userDescription] + ", " +
     [character.visual_style_prompt] + ", " +
     [prompt_dna.style_modifiers.join(", ")] + ", " +
     [prompt_dna.color_palette]
  4. Return:
     {
       prompt: positive_prompt,
       negative_prompt: prompt_dna.negative_prompt,
       aspect_ratio: prompt_dna.aspect_preferences[platform] || "1:1",
       reference_image_urls: [primary_ref_url],
       model: prompt_dna.provider_overrides?.muapi?.model || "flux-dev"
     }

Build workers/api/src/routes/generate.ts (replace test endpoint):

POST /api/generate/image
Body: { character_id, image_description, platform }

Logic:
1. Verify JWT → get user_id
2. Verify user owns character_id
3. Fetch character from Supabase
4. Verify reference_images_ready = 1 (return 400 if not)
5. Call assembleImagePrompt(character, image_description, platform)
6. Call MuAPIAdapter.generateImage(assembled.prompt, {
     referenceImageUrls: assembled.reference_image_urls,
     aspectRatio: assembled.aspect_ratio,
     negativePrompt: assembled.negative_prompt,
     model: assembled.model
   })
7. R2 path: generations/{userId}/{characterId}/{nanoid()}.png
8. Save image generation to Supabase generations table:
   { character_id, user_id, generation_type:"image", platform, user_prompt:image_description,
     image_url:r2_path, provider:"muapi", model_used, generation_time_ms }
9. Return { image_url, generation_id }

Remove the /api/generate/test endpoint now that the real one works.
```

**Critical test after building:**
1. Create a character with the DNA form
2. Upload a front portrait reference image
3. POST /api/chat → get image_description
4. POST /api/generate/image with that image_description
5. View the generated image — does the face match the reference?

If the face does not match: the reference image URL is not reaching MuAPI correctly. Debug the referenceImageUrls path in the MuAPI adapter.

**Validation checklist:**
- [ ] Image generates using the character's reference image for face consistency
- [ ] Generated image stored in R2 under generations/ path
- [ ] Generation row saved in Supabase with image_url populated
- [ ] Aspect ratio is correct for the platform
- [ ] Character face in generated image resembles the reference photo
- [ ] Commit: "Add Prompt DNA assembly and full image generation"

---

## Day 8 — Chat Studio UI

**Goal:** Users can chat with their character in a beautiful interface. Caption appears immediately. Image generates alongside.

**Claude Prompt — Day 8:**
```
Build the Chat Studio for PersonalityOS.

Read:
- docs/MVP_SCOPE.md (Flow 3: Chat Studio + Flow 4 progressive reveal description)

Build app/dashboard/[characterId]/chat/page.tsx:

Layout (full height, no scroll on outer container):
  Top: Character header bar
    - Character primary reference image (small circle avatar)
    - Character name (large, bold)
    - Character domain (smaller, muted)
    - "Library" button (links to /dashboard/[characterId]/library)
    - "Settings" button (links to /dashboard/[characterId]/settings)

  Middle: Scrollable chat history area
    - Shows previous generations as chat messages
    - Each generation = one card (described below)
    - Empty state: "Ask {name} to create content for you →"

  Above input: Platform shortcut buttons
    [ Instagram Post ] [ LinkedIn Post ] [ X Thread ] [ Carousel ] [ Story ]
    Each button: small, pill-shaped, outlined
    On click: pre-fills input with "Create a [platform] post about: "

  Bottom: Input area (fixed at bottom)
    - Textarea: "Ask {name} to create content..."
    - Send button (or Enter to send)
    - Shows character avatar left of input

Generation card (appears in chat history after each generation):
  Two-panel card:
  Left panel (60% width):
    - Platform badge (Instagram / LinkedIn / X etc.)
    - Caption text (full, scrollable if long)
    - Copy to clipboard button
    - Hashtags shown as pills below caption
  Right panel (40% width):
    - Image area: shows skeleton/spinner while generating
    - When image arrives: shows the image
    - Download button below image
    - Aspect ratio shown (1:1 / 9:16 etc.)

Generation flow in UI:
  1. User sends message
  2. POST /api/chat → caption arrives (~4s)
     Left panel fills immediately with caption
     Right panel shows animated placeholder
  3. POST /api/generate/image starts in parallel
  4. Poll for result or use response streaming
  5. When image URL arrives: replace placeholder with image (~20-25s total)

Use shadcn/ui: Card, Button, Textarea, Badge, Skeleton
Dark theme. Clean. Professional.
```

**Validation checklist:**
- [ ] Chat studio opens for a character
- [ ] Platform shortcuts pre-fill the input correctly
- [ ] Sending a message shows caption in ~5 seconds
- [ ] Image placeholder shows during generation
- [ ] Image appears when generation completes
- [ ] Copy button copies caption to clipboard
- [ ] Download button downloads the image
- [ ] Commit: "Add Chat Studio with platform shortcuts and progressive image reveal"

---

## Day 9 — Polish Chat + Wire Everything Together

**Goal:** End-to-end flow works perfectly. Every edge case handled.

**Claude Prompt — Day 9:**
```
Polish the PersonalityOS chat flow and handle edge cases.

1. Loading and error states:
   - If /api/chat fails: show "Something went wrong. Try again." with retry button
   - If /api/generate/image fails: show "Image generation failed. Retry?" button
     (clicking retry calls generate/image again with same description)
   - If character has no reference images: show warning before sending
     "Upload a reference photo first for consistent images → Settings"

2. Character completeness check:
   When chat studio opens:
   - If dna_ready = 0: redirect to create form
   - If reference_images_ready = 0: show banner:
     "For consistent images, add a reference photo"
     with "Add Photo" button (opens settings)
   - If both ready: chat is fully active

3. Image polling:
   After POST /api/generate/image starts:
   Frontend should poll GET /api/generate/image/:id every 3 seconds
   until status = "completed" or "failed"
   (The Worker saves a "pending" row first, updates to "completed" when done)
   Update generate.ts to:
     - INSERT row immediately with status "pending"
     - Return the generation_id
     - Continue async processing
     - UPDATE row when complete
   Add: GET /api/generate/image/:id → returns status + image_url when complete

4. Character settings page (app/dashboard/[characterId]/settings/page.tsx):
   Section 1: Edit identity (name, domain, style_preset)
   Section 2: Reference images (from Day 4 — already built)
   Section 3: Style controls (simple UI that modifies prompt_dna):
     - Style modifiers: tag input (add/remove modifiers)
     - Color palette: text input
     - Default model: select (flux-dev | flux-schnell)
   Save button → PUT /api/characters/:id → regenerates system_prompt + prompt_dna
```

**Validation checklist:**
- [ ] End-to-end: signup → create character → upload photo → generate Instagram post → caption + image appear
- [ ] Error states show friendly messages (test by temporarily breaking the API URL)
- [ ] Character with no reference image shows appropriate warning
- [ ] Settings page saves changes and they affect the next generation
- [ ] Commit: "Polish chat flow, error states, settings page"

---

## Day 10 — Asset Library

**Goal:** All past generations are browsable, downloadable, and organised by character.

**Claude Prompt — Day 10:**
```
Build the Asset Library for PersonalityOS.

Read: docs/MVP_SCOPE.md (Flow 5: Asset Library)

Backend: workers/api/src/routes/library.ts

GET /api/library
Query params: character_id, type (all|text|image), page (default 1), limit (default 20)
Logic:
1. Verify JWT
2. Build Supabase query:
   SELECT * FROM generations
   WHERE character_id = $1 AND user_id = $2
   [AND generation_type = $3 if type != "all"]
   ORDER BY created_at DESC
   LIMIT $limit OFFSET $offset
3. Return: { generations: [...], total: count, page, has_more }

Frontend: app/dashboard/[characterId]/library/page.tsx

Layout:
  Header: "{Character Name} Library" + generation count
  Filter bar: All | Images | Captions
  Grid: 3 columns on desktop, 2 on mobile, 1 on small mobile

Each asset card:
  For images:
    - Thumbnail (image from image_url)
    - Platform badge
    - Date (relative: "2 days ago")
    - Download button
    - Click to open full-screen modal
  For text:
    - Platform badge
    - First 100 characters of caption
    - Date
    - Copy button
    - Click to expand full caption in modal

Full-screen modal (click any asset):
  Image: shows full image + caption if there's a linked text generation
  Text: shows full caption + copy button

Infinite scroll or "Load more" button at bottom.
Empty state: "No content yet. Go to Chat Studio to create your first post →"
```

**Validation checklist:**
- [ ] Library shows all past generations
- [ ] Filter by Images shows only images
- [ ] Filter by Captions shows only text
- [ ] Download works for images
- [ ] Copy works for captions
- [ ] Clicking an asset opens the full modal
- [ ] Commit: "Add Asset Library with filter, download, and full-screen modal"

---

## Day 11 — Multi-Character Dashboard

**Goal:** Dashboard is beautiful. Multiple characters work perfectly. New character creation is seamless.

**Claude Prompt — Day 11:**
```
Polish the PersonalityOS dashboard for multi-character use.

Read: docs/MVP_SCOPE.md (Flow 6: Multi-Character Dashboard)

Update app/dashboard/page.tsx:

Layout:
  Header: "PersonalityOS" logo left, user email + sign out right
  Below header: "Your Characters" heading + "New Character" button right-aligned
  Character grid: 3 columns desktop, 2 tablet, 1 mobile

Character card (each):
  - Primary reference image (full card height top half, object-fit: cover)
    OR placeholder gradient with character initials if no image
  - Bottom half: name (bold large), domain (smaller muted), last used date
  - "Open Chat" button (full width, primary)
  - Generation count badge (e.g. "24 posts")
  - On hover: slight scale up animation

Empty state (no characters):
  Centered illustration placeholder
  "Create your first character" (large heading)
  "Give it a face, a personality, and let it create content for you." (subheading)
  "Get Started" button → /dashboard/create

Create character button behavior:
  Small floating button bottom-right on mobile
  Regular button in header on desktop

Also update the navigation between character views:
  /dashboard/[id]/chat → shows "Chat" as active
  /dashboard/[id]/library → shows "Library" as active
  /dashboard/[id]/settings → shows "Settings" as active
  Consistent tab-style navigation across all three views.
```

**Validation checklist:**
- [ ] Dashboard shows character cards with reference images
- [ ] Each card shows correct generation count
- [ ] Creating a second character works without issues
- [ ] Navigation between chat / library / settings is smooth
- [ ] Empty state looks good
- [ ] Commit: "Polish multi-character dashboard and navigation"

---

## Day 12 — Pre-Deployment + Deploy

**Goal:** App is live on the internet at a real URL.

### Morning — Pre-deployment review

**Claude Prompt — Day 12, Part 1:**
```
Review PersonalityOS before production deployment.

Check every Worker route file for:
1. Any API key hardcoded in source (should be zero)
2. Any route that does not verify JWT before touching data
3. Any user_id taken from request body (should always come from JWT)
4. Error responses that expose internal details (stack traces, SQL errors)
5. CORS headers currently set to localhost:3000 only (need to also allow Pages URL)

Files to check:
- workers/api/src/middleware/auth.ts
- workers/api/src/routes/characters.ts
- workers/api/src/routes/chat.ts
- workers/api/src/routes/generate.ts
- workers/api/src/routes/library.ts

Report all issues. Fix Critical and High before I deploy.
```

Fix all critical issues.

### Afternoon — Deploy

```bash
# Create R2 bucket in production
wrangler r2 bucket create personalityos-storage

# Deploy Worker
cd workers/api
wrangler deploy

# Set production secrets
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_ANON_KEY
wrangler secret put SUPABASE_SERVICE_KEY
wrangler secret put ANTHROPIC_API_KEY
wrangler secret put OPENROUTER_API_KEY
wrangler secret put MUAPI_API_KEY
wrangler secret put POSTHOG_API_KEY
wrangler secret put LLM_PROVIDER
```

Note deployed Worker URL: `personalityos-api.yourname.workers.dev`

Deploy frontend:
1. Cloudflare Dashboard → Pages → Create Project → Connect GitHub
2. Build: Framework = Next.js, Command = `npm run build`, Output = `.next`
3. Environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `NEXT_PUBLIC_WORKER_URL` = your Worker URL

After Pages deploys, note URL: `personalityos.pages.dev`

**Claude Prompt — Day 12, Part 2:**
```
My Cloudflare Pages URL is: [YOUR PAGES URL]

Update CORS headers in workers/api/src/index.ts to allow:
- http://localhost:3000 (development)
- https://[your pages URL] (production)

Also update Supabase → Authentication → URL Configuration:
- Site URL: https://[your pages URL]
- Redirect URLs: add https://[your pages URL]/auth/callback

Show exact changes needed.
```

**Validation checklist:**
- [ ] Worker deployed: `curl https://your-worker.workers.dev/health` → `{"status":"ok"}`
- [ ] Pages live: personalityos.pages.dev loads
- [ ] Sign up works on production (check Supabase Auth → Users)
- [ ] Create character works on production
- [ ] Chat generates caption on production
- [ ] Image generates on production
- [ ] Image appears in Asset Library
- [ ] Commit: "Production deployment"

---

## Day 13 — End-to-End Test + Edge Cases

**Goal:** Every flow works perfectly. The critical failure modes are handled gracefully.

**Claude Prompt — Day 13:**
```
PersonalityOS is live. Help me harden the critical paths.

1. What happens when MuAPI is slow (>30 seconds)?
   - Frontend should show a "Still generating..." message after 15 seconds
   - Polling should continue up to 90 seconds
   - After 90 seconds: show "Image generation timed out. Try again." with retry

2. What happens when the image generation completely fails?
   - generations row should update to status "failed"
   - Frontend should show retry button
   - Caption should remain available even if image fails

3. What happens if LLM returns malformed JSON?
   - Worker should try to extract JSON from the response (strip markdown fences)
   - If still invalid: return 422 with "Content generation failed, please try again"
   - Log the raw response for debugging

4. What happens if user uploads a non-image file?
   - Validate MIME type server-side (not just file extension)
   - Return 400: "Only JPEG and PNG files are supported"

5. What happens if Supabase is briefly unavailable?
   - Worker should return 503 with "Service temporarily unavailable"
   - Never expose Supabase error details to the user

Fix the top 3 most critical issues. Document the rest.
```

**Validation checklist:**
- [ ] Image timeout shows friendly message
- [ ] Failed image shows retry button (caption stays visible)
- [ ] Invalid file type shows clear error
- [ ] Complete end-to-end test in fresh incognito window
- [ ] Commit: "Edge case handling and error message polish"

---

## Day 14 — Polish + README + First Users

**Goal:** App looks complete. README written. First 3 real users try it.

### Morning — Final UI polish

**Claude Prompt — Day 14:**
```
Final polish for PersonalityOS before sharing with users.

1. Loading states: every page that fetches data should show
   shadcn/ui Skeleton placeholders — never a blank screen.
   Pages to check: dashboard, chat history, library.

2. Consistent empty states with action CTAs on every page.

3. Page titles (shown in browser tab):
   /dashboard → "PersonalityOS — Your Characters"
   /dashboard/[id]/chat → "{Character Name} — Chat Studio"
   /dashboard/[id]/library → "{Character Name} — Library"
   /dashboard/create → "Create Character — PersonalityOS"

4. Favicon: simple "P" monogram, dark background.
   Create as SVG and place in public/favicon.svg

5. Mobile: test every page at 375px width.
   Fix any obvious overflow or broken layouts.
   Chat Studio must be usable on mobile.
```

### Afternoon — README

**Claude Prompt — Day 14, Part 2:**
```
Write README.md for PersonalityOS GitHub repository.

Include:
1. Tagline: "Own Your AI Identity"
2. What it is (3 sentences)
3. Tech stack (one line each)
4. How to run locally (exact commands)
5. Key architecture: one Worker, one database, Provider Adapter
6. Folder structure
7. How to deploy
8. What's next (V2 Video, V3 Voice, V4 Marketplace)

Under 200 lines. No fluff.
```

### Evening — First users

Find 3 people from the target group:
- One content creator (Instagram or LinkedIn)
- One educator or coach
- One person building a personal brand

Share the URL. Say only: "I built something. Create an AI character and make a post. Let me know what's confusing."

Watch them use it silently. Write down:
- Every moment they pause and look confused
- Every feature they look for and cannot find
- Every time they say anything out loud about the experience

This is worth more than any feature you could build today.

**Validation checklist:**
- [ ] Loading skeletons on all data pages
- [ ] Browser tab titles correct
- [ ] App usable on 375px mobile screen
- [ ] README committed and visible on GitHub
- [ ] At least one non-technical person has completed the full flow
- [ ] User feedback documented
- [ ] Final commit: "V1 stable: polish, README, ready for users"

---

## After Day 14

**What you have:**
- A working Digital Identity OS
- Users can create characters with consistent faces
- Chat interface generates social-ready captions + images
- Asset library stores everything permanently
- Multiple characters per user
- Provider Adapter ready for FAL.ai swap when needed

**V1.5 (next 7 days, based on user feedback):**
- Direct social posting (Instagram OAuth)
- Better face consistency (test FAL.ai vs MuAPI)
- 2-3 pre-built character templates users can start from

**V2 (next 30 days):**
- Video generation (Kling / Runway adapters)
- Video shortcuts in chat (same interface, new capability)

---

## Daily Log Template

```
Date:
Day:

Goal:

Completed:


Not finished (tomorrow):


Bugs found:


What confused me:


Tomorrow's first task:


Git commits:

```
