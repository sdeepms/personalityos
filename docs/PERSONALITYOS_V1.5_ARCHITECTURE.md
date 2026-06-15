# PersonalityOS — V1.5 Architecture Document

**Version:** 1.5
**Status:** Pre-build — Architecture Finalized
**Date:** June 2026
**Previous Version:** V1 Live at https://personalityos-d1x.pages.dev
**Author:** CTO Agent

---

## Table of Contents

1. [V1.5 Goals](#1-v15-goals)
2. [Core Principles — What Does Not Change](#2-core-principles--what-does-not-change)
3. [Testing Strategy — Feature Branches Before Production](#3-testing-strategy--feature-branches-before-production)
4. [Item 1 — Fix Image Expiry](#4-item-1--fix-image-expiry)
5. [Item 2 — Domain-Based Character Creation](#5-item-2--domain-based-character-creation)
6. [Item 3 — Attachment System (+ Icon)](#6-item-3--attachment-system--icon)
7. [Item 4 — Offer Pills for Resellers](#7-item-4--offer-pills-for-resellers)
8. [Item 5 — Background Generation (Complete Fix)](#8-item-5--background-generation-complete-fix)
9. [Item 6 — Prompt Preview Toggle + Regenerate/Edit](#9-item-6--prompt-preview-toggle--regenerateedit)
10. [Database Changes — Complete V1.5 Migration](#10-database-changes--complete-v15-migration)
11. [Backend Routes — Complete Map](#11-backend-routes--complete-map)
12. [Provider Adapter Changes](#12-provider-adapter-changes)
13. [Build Order — Day by Day](#13-build-order--day-by-day)
14. [Risk Register](#14-risk-register)
15. [Success Criteria](#15-success-criteria)

---

## 1. V1.5 Goals

V1.5 has one sentence:

> **Serve WhatsApp resellers and product sellers with their own generation flow, fix the data integrity issue from V1, and make generation robust enough that users can trust it will complete even if they close the tab.**

### What V1.5 Proves

- A reseller can generate a product post in under 5 minutes without filling any form twice
- A user's asset library never shows broken images
- A generation always completes, even if the user closes the browser

### What V1.5 Does NOT Do

- Video generation (V2)
- Web search integration (V2)
- Direct social media posting (V2)
- Payments or Stripe (post-V2)
- Voice or audio (V3)

---

## 2. Core Principles — What Does Not Change

Before listing changes, anchor what is NOT touched in V1.5.

| Component | Status |
|---|---|
| Supabase database connection | Unchanged |
| Cloudflare Worker + Hono router | Unchanged (one new Consumer Worker added) |
| Provider Adapter pattern | Extended, not rebuilt |
| Auth system (Supabase JWT) | Unchanged |
| R2 bucket structure | Extended with new paths |
| OpenNext Cloudflare adapter | Unchanged |
| Existing chat flow for educators | Unchanged |
| Library page | Unchanged |
| Dashboard character grid | Minor additions only |

V1.5 is **additive**. Nothing in V1 is removed or broken.

---

## 3. Testing Strategy — Feature Branches Before Production

**You explicitly asked to test everything in isolation before touching production.**

This is the correct approach. Here is the exact strategy:

### Branch Strategy

Every V1.5 item is built on its own feature branch. Nothing merges to `main` until you have personally tested it end-to-end and approved it.

```
main (V1 — always stable, always live)
  │
  ├── feature/v1.5-image-expiry
  ├── feature/v1.5-domain-character
  ├── feature/v1.5-attachment-system
  ├── feature/v1.5-offer-pills
  ├── feature/v1.5-background-generation
  └── feature/v1.5-prompt-preview
```

### Two Environments

| Environment | URL | Branch | Purpose |
|---|---|---|---|
| Production | personalityos-d1x.pages.dev | main | Real users. Never broken. |
| Staging | v15-staging.pages.dev (new) | feature/* | Your testing. Safe to break. |

**How to set up staging:**

Cloudflare Pages supports multiple deployments from the same GitHub repo. You create a second Pages project pointing to your feature branches. It uses the same Worker, same Supabase, same R2 — so you test with real data but a separate frontend URL.

No new infrastructure cost. Cloudflare Pages is free for additional projects.

**Database safety:**

All V1.5 database migrations use `ADD COLUMN IF NOT EXISTS` and `CREATE TABLE IF NOT EXISTS`. They are non-destructive. Running them on the same Supabase instance will not break V1 data.

New tables and columns have safe defaults. No existing rows are modified.

### Per-Item Testing Checklist

Each item has a validation checklist at the end of its section. Do not merge a branch until every checkbox is ticked.

---

## 4. Item 1 — Fix Image Expiry

**Priority:** 1 (do this first — data integrity)
**Effort:** 1-2 days
**Branch:** `feature/v1.5-image-expiry`

### The Problem (Plain English)

When MuAPI generates an image, it returns a URL like:
```
https://d3adwkbyhxyrtq.cloudfront.net/image/xyz.jpg
```

This URL is temporary. It expires in approximately 30 days. You store this URL in Supabase. After 30 days, users open their library and see broken images.

In V1, the Worker tried to download this image and re-upload to R2. It failed because MuAPI's CDN blocks downloads from Cloudflare's IP addresses (returns 403 Forbidden).

### The Solution

**Download on the frontend (browser), not the Worker.**

The browser has no IP restriction. MuAPI's CDN serves images to browsers normally. The browser downloads the image binary and sends it to your Worker, which saves it to R2 and returns a permanent URL.

### The Flow

```
Step 1: Worker calls MuAPI → gets temporary CDN URL
Step 2: Worker saves temporary URL to Supabase (status: saving)
Step 3: Worker returns temporary URL + generation_id to frontend
Step 4: Frontend displays the image immediately (user sees it fast)
Step 5: Frontend fetches image binary from CDN URL (browser, no restriction)
Step 6: Frontend sends binary to Worker: POST /api/generations/:id/save-to-r2
Step 7: Worker uploads binary to R2: generations/{userId}/{characterId}/{genId}.png
Step 8: Worker updates Supabase: image_url = R2 path, status = completed
Step 9: Frontend swaps displayed URL to permanent R2 URL silently
```

User experience: They see the image immediately. The background save happens silently. They never know it happened.

### New Backend Route

```
POST /api/generations/:id/save-to-r2
Auth: Required (JWT)
Body: multipart/form-data — image binary
Steps:
  1. Verify JWT
  2. Verify generation belongs to user
  3. Upload binary to R2: generations/{userId}/{characterId}/{id}.png
  4. Update Supabase: image_url = R2 path, status = 'completed'
  5. Return: { permanent_url: "/files/generations/..." }
```

### Frontend Change

In `ChatClient.tsx`, after receiving the generation result:

```
Receive generation result
  → Show image from temporary CDN URL
  → Immediately call save-to-r2 in background (non-blocking)
  → On save success: swap image src to permanent R2 URL
  → On save failure: keep CDN URL, log error (retry on next load)
```

### R2 Path for Generated Images

```
generations/{userId}/{characterId}/{generationId}.png
```

Served publicly via existing Worker route: `GET /files/*`

### What Happens to Old Expired Images

In the Library page, images with expired CDN URLs already show a placeholder. We do not retroactively fix old generations — that would require re-downloading from expired URLs (impossible). Only new generations from V1.5 onward will have permanent R2 URLs.

A small note in the Library: "Images generated before [date] may have expired. Regenerate if needed." is sufficient.

### Validation Checklist

- [ ] Generate a new image in staging environment
- [ ] Check Supabase: `image_url` field shows R2 path (not CDN URL)
- [ ] Check R2 dashboard: image file exists under `generations/`
- [ ] Open Library: image loads from R2 URL
- [ ] Wait check: Simulate by manually setting CDN URL — Library shows permanent R2 URL instead
- [ ] Edge case: User closes tab immediately after generation — on return, check if save-to-r2 was called. If not, add retry logic on Library load.

---

## 5. Item 2 — Domain-Based Character Creation

**Priority:** 2 (foundation for everything else)
**Effort:** 1-2 days
**Branch:** `feature/v1.5-domain-character`

### The Change

Character creation currently has a free-text domain field and assumes all users are educators or content creators. V1.5 adds a character type selection that branches the entire experience.

### Three Character Types

| Type | Who | What Changes |
|---|---|---|
| `educator` | Teachers, coaches, UPSC, finance educators | Current experience — mostly unchanged |
| `creator` | Personal brand builders, influencers, lifestyle | Similar to educator, different tone defaults |
| `reseller` | WhatsApp sellers, e-commerce, product sellers | Different DNA, enables attachment system for products |

### Two-Step Creation Flow

**Step 1 — Choose Type (new screen)**

Three large visual cards. Each shows:
- An icon
- A title ("Product Reseller / E-Commerce")
- A two-line description of who this is for
- Example use case ("Sell products on WhatsApp, Instagram, Facebook")

User taps one card. Proceeds to Step 2.

**Step 2 — Fill Details (branched by type)**

For `educator` and `creator`:
- Same visual card form as V1 (name, domain, gender, age, nationality, style preset)
- Minor copy changes for creator type
- Upload reference photo (unchanged)

For `reseller`:
- Name (their name or store name)
- Store/Brand name (new field — used in captions)
- Product category (text input with quick chips: Fashion / Food / Electronics / Beauty / Home / Other)
- Gender (same cards as V1)
- Style (three cards: Friendly & Warm / Professional & Trustworthy / Festive & Exciting)
- Upload reference photo (their face — used for person-with-product generation)

### DNA Assembly Changes

`dna-assembler.ts` branches based on `character_type`:

**Educator system_prompt structure:**
```
Current logic — unchanged
```

**Creator system_prompt structure:**
```
You are {name}, a {domain} content creator.
You create content that is {style_preset_description}.
Your audience connects with you personally.
You share your perspective, your experiences, and your opinions.
[style-specific voice instructions]
```

**Reseller system_prompt structure:**
```
You are {name}, a seller at {store_name}.
You sell {product_category} products.
Your communication style is {style_description}.
You write captions that are direct, warm, and focused on making it
easy for customers to understand the product and how to order.
You always include the price, key details, and a clear call to action.
You never invent product details — you only use what the user tells you.
You write in a conversational style suited to {platform}.
```

**Reseller prompt_dna defaults:**
```json
{
  "style_modifiers": [
    "professional product photography",
    "clean background",
    "sharp focus",
    "high detail",
    "commercial quality"
  ],
  "negative_prompt": "cartoon, anime, blurry, low quality, deformed, text overlay, watermark",
  "color_palette": "bright, clean, commercial, inviting",
  "aspect_preferences": {
    "instagram": "1:1",
    "whatsapp": "1:1",
    "facebook": "1:1",
    "story": "9:16",
    "carousel": "1:1"
  },
  "provider_overrides": {
    "muapi": {
      "default_model": "ai-product-photography",
      "fallback_model": "nano-banana-edit"
    }
  }
}
```

### Database Migration

```sql
-- Safe: adds column with default, no existing data affected
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS character_type TEXT DEFAULT 'educator';

-- Update existing characters safely
UPDATE characters 
SET character_type = 'educator' 
WHERE character_type IS NULL;
```

### What Changes in the Dashboard

Character cards on the dashboard show a small type badge:
- 🎓 Educator
- ✨ Creator
- 🛍️ Reseller

This helps users with multiple characters distinguish them at a glance.

### Validation Checklist

- [ ] Step 1 card selection works — correct type stored in DB
- [ ] Reseller creation form shows correct fields
- [ ] Educator creation form unchanged from V1
- [ ] `character_type` column in Supabase shows correct value
- [ ] `system_prompt` assembled differently for reseller vs educator (check in Supabase)
- [ ] `prompt_dna` defaults differ for reseller (check in Supabase)
- [ ] Existing characters (from V1) show as `educator` type — no breakage
- [ ] Dashboard type badges show correctly

---

## 6. Item 3 — Attachment System (+ Icon)

**Priority:** 3 (enables product generation and reference images)
**Effort:** 2-3 days
**Branch:** `feature/v1.5-attachment-system`

### The Concept

A "+" icon in the chat message box opens an attachment picker. What appears in the picker depends on `character_type`. Attachments are sent with the generation request and influence both caption and image generation.

This is a **universal, extensible input layer**. It works for all user types now and for all future content types (video references, documents, audio) in future versions.

### What the "+" Opens Per Type

**For Educator / Creator:**
```
[📷 Upload reference image]
  Caption: "An image for mood or style inspiration"
────────────────────────────
[Recent uploads]
  (thumbnails of previously uploaded reference images)
```

**For Reseller:**
```
[📷 Upload new product photo]
────────────────────────────
[My Products]  (saved product library from Settings)
  Red Silk Kurti  [thumbnail]
  Blue Dupatta    [thumbnail]
  Summer Set      [thumbnail]
[+ Add new product to library →]
```

### Attachment Object Structure

Every attachment sent with a generation request uses this shape:

```typescript
interface Attachment {
  id: string;
  type: 'product_image' | 'reference_image';
  url: string;           // R2 path
  public_url: string;    // served via /files/* route
  label: string;         // display name shown in picker
  source: 'library' | 'fresh_upload';
}
```

This structure is forward-compatible. Future types (`video_clip`, `document`, `audio`) simply add new values to the `type` field.

### UI Behavior in the Message Box

Selected attachments appear as chips inside the message box, above the text input:

```
┌─────────────────────────────────────────┐
│ [📷 Red Silk Kurti ×]                   │
│                                         │
│ Make a festive post for this kurti      │
│                                         │
│ [+]                          [Send →]   │
└─────────────────────────────────────────┘
```

- Tap "×" on a chip to remove the attachment
- Multiple attachments allowed (max 3 for V1.5)
- If no attachment: send button uses existing generation logic
- If attachment present: send button uses attachment-aware generation logic

### How Attachments Affect Generation

**Caption generation (`/api/chat`):**

The attachments array is added to the request body. The LLM prompt is extended:

For `reference_image` (educator/creator):
```
[existing system prompt]

The user has provided a reference image for mood/style inspiration.
Reference image URL: {url}
Generate content that matches the mood, color palette, and energy of this reference image.
Do not describe the reference image in the caption — use it only as style inspiration.
```

For `product_image` (reseller):
```
[existing system prompt]

The user is creating content for this product: {label}
Product image is attached for context.
The caption must describe this specific product.
Use only the details the user provides — do not invent specifications.
```

**Image generation (`/api/generate/image` or `/api/generate/product`):**

The backend reads `character_type` + attachments to decide which MuAPI endpoint to call:

```
No attachment:
  → nano-banana-edit (character only, existing behavior)

attachment.type = 'reference_image':
  → nano-banana-edit with style modifiers from reference
  → Image prompt includes: "in the style and mood of [reference description]"

attachment.type = 'product_image' AND character_type = 'reseller':
  → ai-product-photography (person + product)
  → person_image_url = character's primary reference image (served via /files/)
  → product_image_url = attachment public_url
```

### New Backend Route — Generate with Product

```
POST /api/generate/product
Auth: Required
Body: {
  character_id: string,
  image_description: string,
  platform: string,
  attachments: Attachment[]
}

Steps:
  1. Verify JWT → get user_id
  2. Verify character ownership
  3. Check daily generation limit (same limit as existing)
  4. Fetch character (reference_image_urls, prompt_dna)
  5. Get primary reference image URL (person image)
  6. Get product image URL from attachments[0]
  7. Push job to Cloudflare Queue (see Item 5)
  8. Return { job_id, status: 'pending' }
```

### Modified Route — Generate Image

`POST /api/generate/image` now accepts optional `attachments` in body. If no attachments, behavior is identical to V1.

### Fresh Upload Flow

When user taps "+ Upload new product photo" (or reference image):
- File picker opens
- User selects image
- Frontend uploads to Worker: `POST /api/upload/attachment`
- Worker saves to R2: `attachments/{userId}/{timestamp}.jpg`
- Returns attachment object with URL
- Attachment chip appears in message box
- For resellers: option to "Save to My Products" appears after upload

### R2 Paths

```
Temporary attachments (not saved to library):
  attachments/{userId}/{timestamp}.jpg

Saved product images (permanent):
  products/{userId}/{characterId}/{productId}.jpg

Saved reference images (permanent):
  references/{userId}/{characterId}/{refId}.jpg
```

### Validation Checklist

- [ ] "+" icon appears in chat message box for all character types
- [ ] Educator picker shows reference image upload option
- [ ] Reseller picker shows product library + upload option
- [ ] Attachment chip appears in message box after selection
- [ ] "×" removes attachment chip
- [ ] Sending with product attachment calls `ai-product-photography`
- [ ] Sending without attachment calls existing `nano-banana-edit` (unchanged)
- [ ] Sending with reference image for educator affects image style
- [ ] Maximum 3 attachments enforced
- [ ] Generation result shows in chat card as normal

---

## 7. Item 4 — Offer Pills for Resellers

**Priority:** 4
**Effort:** 1-2 days
**Branch:** `feature/v1.5-offer-pills`

### The Concept

Resellers sell the same products repeatedly. They should not retype "Red Silk Kurti ₹899 available in S M L XL DM to order" every day. Instead, they create offer pills once in Settings and tap them in Chat to pre-fill the message box.

This replaces the intent shortcut pills for reseller characters. Educator/Creator characters keep the existing intent shortcuts unchanged.

### What an Offer Pill Is

A saved, reusable content snippet that pre-fills the chat input.

```
Pill label (shown in chat):  "Red Kurti ₹899"
Full description (injected): "Red Silk Kurti, price ₹899, available in sizes Small, Medium, Large, XL. Customer can DM to order. COD available."
```

The label is short (shown on the pill button). The full description is what actually goes into the generation prompt.

### UI in Chat Studio

For reseller characters, the row above the chat input shows:

```
[🛍️ Red Kurti ₹899] [👗 Blue Dupatta ₹1499] [🔥 Summer Sale 30% off] [+ New Offer]
```

Tap a pill → full description pre-fills the message input.
Tap "+ New Offer" → navigates to Settings → My Offers section.
User can still edit the pre-filled text before sending.

For educator/creator characters: existing intent shortcut pills — unchanged.

### Settings — My Offers Section

New section in `/dashboard/settings?id=`:

```
My Offers
─────────────────────────────────
[+ Add Offer]

  Red Silk Kurti          [Edit] [Delete]
  "Red Silk Kurti, ₹899, S-XL, DM to order"

  Blue Dupatta            [Edit] [Delete]
  "Blue Dupatta Set, ₹1499, festive look"

  Summer Sale             [Edit] [Delete]
  "Flat 30% off all items this week"
```

Add/Edit offer form:
```
Pill label:       [Red Kurti ₹899        ] (max 30 characters)
Full description: [Red Silk Kurti, price ₹899, available in sizes S, M, L, XL. DM to order. COD available.]
                  (max 200 characters)
[Save Offer]
```

Maximum 10 offers per character. Keeps the pill row clean on small screens.

### New Database Table

```sql
CREATE TABLE IF NOT EXISTS character_offers (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,        -- shown on pill, max 30 chars
  description  TEXT NOT NULL,        -- injected into prompt, max 200 chars
  sort_order   INTEGER DEFAULT 0,    -- for drag-to-reorder (future)
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_offers_character ON character_offers(character_id);

ALTER TABLE character_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own offers"
  ON character_offers FOR ALL
  USING (auth.uid() = user_id);
```

### New Backend Routes

```
GET    /api/characters/:id/offers           — list all offers for character
POST   /api/characters/:id/offers           — create new offer
PUT    /api/characters/:id/offers/:oid      — update offer
DELETE /api/characters/:id/offers/:oid      — delete offer
```

All routes verify JWT + character ownership before touching data.

### How Offers Affect Generation

When user taps a pill and sends, the offer description is prepended to the user message in the LLM call:

```
User message sent to LLM:
"PRODUCT: Red Silk Kurti, price ₹899, available in sizes S, M, L, XL. DM to order. COD available.
USER REQUEST: Create an Instagram post for this product"
```

This ensures the LLM always has full product context without the user typing it.

### Validation Checklist

- [ ] Reseller character shows offer pills row (educator does not)
- [ ] "Add Offer" in Settings creates a pill visible in chat
- [ ] Tapping pill pre-fills message box with full description
- [ ] User can edit pre-filled text before sending
- [ ] Edit offer in Settings → pill label updates in chat
- [ ] Delete offer → pill disappears from chat
- [ ] Maximum 10 offers enforced (Add button disabled at 10)
- [ ] Generation using offer pill produces product-relevant caption

---

## 8. Item 5 — Background Generation (Complete Fix)

**Priority:** 5
**Effort:** 3-4 days (most complex item)
**Branch:** `feature/v1.5-background-generation`

### The Problem (Plain English)

Currently, when a user requests a generation:
1. The Worker calls MuAPI and waits for the result (15-25 seconds)
2. If the user closes the browser tab, the Worker connection drops
3. The generation may fail silently
4. The credit is not refunded
5. The user returns and sees nothing

Additionally, Cloudflare Workers have a 30-second CPU time limit on the free plan. If MuAPI is slow, the Worker times out. The user sees an error. Credit is wasted.

### The Complete Solution: Cloudflare Queues

**What Cloudflare Queues is (plain English):**

A queue is like a to-do list that lives in the cloud. Your Worker adds jobs to the list ("generate this image"). A separate worker picks jobs off the list one by one and does the work. The original Worker doesn't wait — it just says "job added" and returns immediately.

This means:
- The user's browser gets a response in under 1 second ("Generation started")
- The user can close the tab
- The generation happens in the background, no matter what
- The result is saved to Supabase when done
- When the user returns, the completed image is waiting

### New Infrastructure Required

1. **Cloudflare Queue:** `personalityos-generation-queue` (free tier: 1 million operations/month)
2. **Queue Consumer Worker:** A small separate Worker that processes jobs from the queue

**Setup command (run once):**
```bash
wrangler queues create personalityos-generation-queue
```

### Architecture

```
User hits Generate
       │
       ▼
POST /api/generate/image (or /api/generate/product)
  1. Validate request (JWT, ownership, daily limits)
  2. Create generation row in Supabase (status: 'pending')
  3. Push job to Queue: { generation_id, character_id, user_id, prompt, attachments }
  4. Return immediately: { job_id: generation_id, status: 'pending' }
       │
       ▼ (milliseconds — user sees "Generating..." immediately)

[In parallel, Queue Consumer Worker picks up the job]
  1. Fetch character from Supabase
  2. Assemble full image prompt
  3. Call correct MuAPI endpoint (based on attachments)
  4. Poll MuAPI until complete (no timeout pressure — Consumer has 15 min limit)
  5. Frontend browser downloads image and calls save-to-r2 (from Item 1)
     OR Consumer downloads and uploads to R2 if user is offline
  6. Update Supabase generation row: status = 'completed', image_url = R2 path

[Frontend polls for status]
  GET /api/generations/:id/status → returns { status, image_url? }
  Frontend polls every 3 seconds
  When status = 'completed': displays the image
  User can leave tab — on return, polling resumes automatically
```

### New Files

**`workers/queue-consumer/src/index.ts`**
The Queue Consumer Worker. Handles all generation jobs from the queue. Has its own `wrangler.toml`.

**`workers/queue-consumer/wrangler.toml`**
```toml
name = "personalityos-queue-consumer"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[[queues.consumers]]
queue = "personalityos-generation-queue"
max_batch_size = 1
max_batch_timeout = 5
max_retries = 3
```

### New Backend Route

```
GET /api/generations/:id/status
Auth: Required
Response: {
  status: 'pending' | 'processing' | 'completed' | 'failed',
  image_url?: string,   -- only when completed
  error?: string        -- only when failed
}
```

### Dashboard Notification

On dashboard load, check for any generations with status `'pending'` or `'processing'` from the last 2 hours for the current user.

If found: show a subtle banner at top of dashboard:
```
⏳ Your generation for Arjun is still processing...
```

When completed: banner changes to:
```
✅ Your generation for Arjun is ready → View in Library
```

This check is a single Supabase query. No websockets. No push notifications. Simple.

### How Chat Studio Handles This

Currently the chat studio blocks while waiting for the image (placeholder shown, input disabled).

With background generation:
- Input is disabled while caption generates (~4-8 seconds — fast, blocking is fine)
- After caption arrives, input re-enables immediately
- Image placeholder shows with a status indicator ("Generating image...")
- User can type their next request while the image generates in background
- When image completes: placeholder replaced with image automatically (polling updates it)

This means users can queue multiple generation requests in the same session.

### Retry Logic

Queue Consumer retries failed jobs up to 3 times automatically (configured in `wrangler.toml`). On permanent failure after 3 retries: update Supabase row to `status: 'failed'`, set `error_message` to a human-readable reason.

Frontend shows retry button when status is `'failed'`.

### Database Change

```sql
-- status column already exists in generations table
-- Just ensure all valid values are documented:
-- 'pending' | 'processing' | 'completed' | 'failed'

-- No schema change needed — column already exists
```

### Validation Checklist

- [ ] Cloudflare Queue created: `wrangler queues list` shows it
- [ ] Consumer Worker deploys: `wrangler deploy` in `workers/queue-consumer/`
- [ ] Submit generation → Supabase shows `status: 'pending'` immediately
- [ ] Consumer picks up job → Supabase updates to `status: 'processing'`
- [ ] Generation completes → Supabase shows `status: 'completed'` with R2 URL
- [ ] Close browser tab after submitting → open new tab → image is completed
- [ ] Status polling in chat shows live updates (pending → processing → completed)
- [ ] Failed job shows retry button in chat
- [ ] Dashboard banner appears for in-progress jobs
- [ ] Daily limits checked BEFORE job is queued (not after)
- [ ] Consumer Worker handles MuAPI timeout gracefully (marks as failed, not silent)

---

## 9. Item 6 — Prompt Preview Toggle + Regenerate/Edit

**Priority:** 6
**Effort:** 1-2 days
**Branch:** `feature/v1.5-prompt-preview`

### Who Gets This

**All character types. All chat pages.** This is not reseller-specific.

Any user who wants to see what will be generated before spending a credit can enable this in Settings.

### The Setting

In `/dashboard/settings?id=` for all character types:

```
Generation Settings
───────────────────
Prompt Preview
Show assembled prompt before generating. 
Review and edit before spending a credit.
[Toggle: OFF / ON]
```

Default: OFF. User opts in.

### Database Change

```sql
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS prompt_preview_enabled BOOLEAN DEFAULT false;
```

### How It Works When Enabled

**Normal flow (toggle OFF — default):**
```
User types → sends → generation starts immediately
```

**Preview flow (toggle ON):**
```
User types → sends → Preview Modal appears
  ┌──────────────────────────────────┐
  │  Preview Before Generating       │
  │                                  │
  │  Caption will say:               │
  │  "Create an Instagram post       │
  │  about Red Silk Kurti, ₹899..."  │
  │                                  │
  │  Image will show:                │
  │  "Person holding a red silk      │
  │  kurti in a warm indoor          │
  │  setting, professional look"     │
  │                                  │
  │  Platform: Instagram • 1 credit  │
  │                                  │
  │  [Edit prompt] [Generate →]      │
  └──────────────────────────────────┘
```

If user clicks "Edit prompt" → modal closes, assembled prompt is placed in the chat input for editing. User edits and sends again (goes through preview again if toggle is on).

If user clicks "Generate →" → generation proceeds normally.

### What "Assembled Prompt" Means in Plain English

The modal shows:
1. What the LLM will be told to write (the caption instruction)
2. What image description will be sent to MuAPI (the image instruction)
3. Which platform and what aspect ratio
4. Credit cost (1 credit)

It does NOT show raw technical prompt text. It shows human-readable summaries of what will happen.

### Regenerate Button

On every generation card in the chat history (all character types), add a Regenerate button.

When clicked:
- Sends the same original user prompt again
- Generates a new caption + image
- New generation card appears below the old one
- Old card remains (user can compare)

This is a simple re-send of the original `user_prompt` stored in the `generations` row.

No backend changes needed. Frontend reads `user_prompt` from the generation record and re-submits to `/api/chat` and `/api/generate/image`.

### Edit Button

On every generation card, add an Edit button.

When clicked:
- The original `user_prompt` is placed back into the chat input box
- User edits it
- Sends as a new generation

No backend changes needed. Pure frontend behavior.

### Where These Buttons Live on the Generation Card

```
┌─────────────────────────────────────────────────┐
│ [Image]    │ [Caption text...]                  │
│            │                                    │
│  [🔄 New] │ [📋 Copy] [✏️ Edit] [🔄 Regen]   │
└─────────────────────────────────────────────────┘
```

Regenerate and Edit appear on all generation cards, for all users, always.
Prompt Preview modal only appears if the character has the toggle enabled.

### Validation Checklist

- [ ] Toggle OFF (default): generation proceeds without modal
- [ ] Toggle ON: modal appears before generation
- [ ] Modal shows human-readable caption instruction and image description
- [ ] "Edit prompt" places text in input for editing
- [ ] "Generate →" proceeds to generation normally
- [ ] Regenerate button on card re-generates with same prompt
- [ ] Edit button places original prompt in input
- [ ] Both Regenerate and Edit work for educator AND reseller characters
- [ ] Toggle setting persists across sessions (stored in Supabase)

---

## 10. Database Changes — Complete V1.5 Migration

Run these SQL statements in Supabase SQL Editor. Each is safe to run on the live database — all use `IF NOT EXISTS` and safe defaults.

**Run in this order:**

```sql
-- 1. Add character_type to characters
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS character_type TEXT DEFAULT 'educator';

UPDATE characters 
SET character_type = 'educator' 
WHERE character_type IS NULL;

-- 2. Add prompt_preview_enabled to characters
ALTER TABLE characters 
ADD COLUMN IF NOT EXISTS prompt_preview_enabled BOOLEAN DEFAULT false;

-- 3. Add product_image_url to generations
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS product_image_url TEXT;

-- 4. Add attachments to generations
ALTER TABLE generations 
ADD COLUMN IF NOT EXISTS attachments TEXT DEFAULT '[]';

-- 5. Create character_offers table
CREATE TABLE IF NOT EXISTS character_offers (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label        TEXT NOT NULL,
  description  TEXT NOT NULL,
  sort_order   INTEGER DEFAULT 0,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_offers_character 
ON character_offers(character_id);

ALTER TABLE character_offers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own offers"
  ON character_offers FOR ALL
  USING (auth.uid() = user_id);

-- 6. Create character_products table
CREATE TABLE IF NOT EXISTS character_products (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  character_id TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  image_url    TEXT NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_character 
ON character_products(character_id);

ALTER TABLE character_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own products"
  ON character_products FOR ALL
  USING (auth.uid() = user_id);
```

### Summary of All Database Changes

| Table | Change | Type |
|---|---|---|
| `characters` | + `character_type TEXT DEFAULT 'educator'` | Alter |
| `characters` | + `prompt_preview_enabled BOOLEAN DEFAULT false` | Alter |
| `generations` | + `product_image_url TEXT` | Alter |
| `generations` | + `attachments TEXT DEFAULT '[]'` | Alter |
| `character_offers` | New table | Create |
| `character_products` | New table | Create |

**Zero existing data is modified. Zero existing queries break.**

---

## 11. Backend Routes — Complete Map

### Existing Routes (Unchanged)

```
GET  /health
GET  /files/*
POST /api/feedback/request-more
GET  /api/characters
POST /api/characters
GET  /api/characters/:id
PUT  /api/characters/:id
POST /api/characters/:id/references
GET  /api/characters/:id/references
POST /api/chat
POST /api/generate/image          ← MODIFIED: accepts attachments, uses Queue
GET  /api/library
```

### Modified Routes

```
POST /api/generate/image
  New behavior: validates + creates pending row + pushes to Queue
  Returns: { job_id, status: 'pending' } instead of blocking
  Body now accepts: attachments?: Attachment[]
```

### New Routes

```
POST /api/generations/:id/save-to-r2
  Auth: Required
  Body: multipart/form-data (image binary)
  Returns: { permanent_url }

GET  /api/generations/:id/status
  Auth: Required
  Returns: { status, image_url?, error? }

POST /api/generate/product
  Auth: Required
  Body: { character_id, image_description, platform, attachments }
  Returns: { job_id, status: 'pending' }

POST /api/upload/attachment
  Auth: Required
  Body: multipart/form-data (image file)
  Returns: Attachment object with R2 URL

GET  /api/characters/:id/offers
POST /api/characters/:id/offers
PUT  /api/characters/:id/offers/:oid
DELETE /api/characters/:id/offers/:oid

GET  /api/characters/:id/products
POST /api/characters/:id/products
DELETE /api/characters/:id/products/:pid
```

### Queue Consumer Routes (Internal — Not HTTP)

The Queue Consumer Worker does not expose HTTP routes. It only processes queue messages. It has access to the same Supabase and R2 bindings as the main Worker.

---

## 12. Provider Adapter Changes

### interface.ts — New Methods

```typescript
interface GenerationProvider {
  // Existing
  generateImage(prompt: string, options: ImageOptions): Promise<GenerationResult>;
  
  // New V1.5
  generateProductPhotography(
    personImageUrl: string,
    productImageUrl: string,
    prompt: string,
    options: ProductPhotographyOptions
  ): Promise<GenerationResult>;

  generateProductShot(
    productImageUrl: string,
    sceneDescription: string
  ): Promise<GenerationResult>;
}

interface ProductPhotographyOptions {
  aspectRatio: string;
}
```

### muapi.ts — New Methods Added

`generateProductPhotography()`:
- Endpoint: `POST https://api.muapi.ai/api/v1/ai-product-photography`
- Body: `{ prompt, person_image_url, product_image_url }`
- Same submit-and-poll pattern as existing `generateImage()`

`generateProductShot()`:
- Endpoint: `POST https://api.muapi.ai/api/v1/ai-product-shot`
- Body: `{ scene_description, image_url }`
- Same submit-and-poll pattern

### factory.ts — Routing Logic

```typescript
function selectGenerationMethod(character, attachments) {
  if (!attachments || attachments.length === 0) {
    return 'generateImage';  // existing behavior
  }
  
  const productAttachment = attachments.find(a => a.type === 'product_image');
  
  if (productAttachment && character.character_type === 'reseller') {
    return 'generateProductPhotography';
  }
  
  if (productAttachment && character.character_type !== 'reseller') {
    return 'generateProductShot';  // product-only, no person
  }
  
  return 'generateImage';  // reference_image — style influence only
}
```

### New File: `providers/image/muapi-product.ts`

Contains `generateProductPhotography()` and `generateProductShot()` implementations. Keeps the main `muapi.ts` clean and unchanged.

---

## 13. Build Order — Day by Day

Each day has one clear goal. Do not start the next day until that day's validation checklist passes completely.

```
Day 1   Fix Image Expiry
        - New Worker route: save-to-r2
        - Frontend: download + upload after generation
        - Test: generate → check R2 → verify permanent URL in DB
        Branch: feature/v1.5-image-expiry → test → merge to main

Day 2   Database Migrations
        - Run all SQL migrations from Section 10
        - Verify no breakage to existing characters/generations
        - Deploy migrations to production Supabase (safe, additive only)
        Branch: part of next feature branch

Day 3   Domain-Based Character Creation
        - Step 1 type selection screen
        - Reseller form fields
        - DNA assembler branching
        - Dashboard type badges
        Branch: feature/v1.5-domain-character → test → merge

Day 4   Cloudflare Queue Setup + Consumer Worker skeleton
        - Create queue: wrangler queues create
        - Create workers/queue-consumer/ folder and wrangler.toml
        - Consumer Worker: receives job, logs it, marks complete (stub)
        - Test queue message flow end-to-end before adding generation logic

Day 5   Background Generation (full)
        - Modify /api/generate/image to push to queue
        - Consumer Worker: full generation logic (MuAPI + R2 save)
        - New route: GET /api/generations/:id/status
        - Frontend: polling logic in chat
        - Dashboard: in-progress banner
        Branch: feature/v1.5-background-generation → test → merge

Day 6   Product Image Library (Settings)
        - New settings section: My Products
        - Backend routes: GET/POST/DELETE /api/characters/:id/products
        - Upload product image → R2 → saved to character_products table
        - Display saved products in Settings as grid

Day 7   Offer Pills (Settings + Chat)
        - New settings section: My Offers
        - Backend routes: CRUD /api/characters/:id/offers
        - Offer pills row in Chat Studio (reseller characters only)
        - Tap pill → pre-fills message input
        Branch: feature/v1.5-offer-pills → test → merge

Day 8   Attachment Picker (+ Icon)
        - Build AttachmentPicker component in isolation
        - "+" icon in message box
        - Educator picker: reference image upload
        - Reseller picker: product library grid + upload
        - Attachment chips in message box
        - Test component in isolation before wiring to generation

Day 9   Wire Attachments to Generation
        - Modify /api/chat to accept and use attachments in LLM prompt
        - Modify /api/generate/image to route based on attachments
        - New route: POST /api/generate/product
        - New MuAPI methods: generateProductPhotography, generateProductShot
        - Test: reseller + product attachment → ai-product-photography called
        Branch: feature/v1.5-attachment-system → test → merge

Day 10  Prompt Preview Toggle + Regenerate/Edit
        - Settings toggle: prompt_preview_enabled
        - Preview modal component
        - Regenerate button on all generation cards
        - Edit button on all generation cards
        Branch: feature/v1.5-prompt-preview → test → merge

Day 11  DNA Assembler — Reseller Prompt System
        - system_prompt assembly for reseller type
        - Platform formatting rules for reseller captions
        - Offer pill description injection into LLM prompt
        - Test: reseller caption sounds like a seller, not an educator

Day 12  Full Integration Testing
        - Complete flow: reseller signs up → creates character
          → uploads product → creates offer pill → opens chat
          → taps offer pill → attaches product image → sends
          → sees caption + product photography image → opens library
        - Complete flow: educator → creates character
          → opens chat → attaches reference image → sends
          → sees style-influenced caption + image → regenerates
        - Background generation: close tab mid-generation → return → image ready
        - Image expiry: all new images load from R2, not CDN

Day 13  Polish + Edge Cases
        - All error states have friendly messages
        - Loading states on all new components
        - Mobile: test at 375px for every new UI element
        - Daily limits respected for all new generation routes
        - Empty states for: no offers yet, no products yet, no generations yet

Day 14  Staging Sign-off → Production Deploy
        - Full walkthrough on staging environment
        - Test with a real reseller (one person, informal)
        - Merge all feature branches to main
        - Deploy Worker + frontend
        - Verify production end-to-end
```

---

## 14. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| MuAPI cannot fetch person image from your Worker's /files/ route | High | Medium | Test this manually on Day 9 before building full UI. If blocked, serve reference images via Supabase Storage URL instead. |
| ai-product-photography output quality is poor | High | Low | Test with 5 real product photos before showing to resellers. If quality is poor, fall back to ai-product-shot (no person) as default. |
| Cloudflare Queue setup complexity blocks progress | Medium | Low | Queue setup is one CLI command. Consumer Worker is a copy of existing Worker with different handler. Allocate Day 4 fully to this. |
| Reseller doesn't understand "character" concept | Medium | High | In onboarding copy, replace "character" with "your seller profile" for reseller type. Same underlying system, different language. |
| Daily limit hit during testing | Low | High | Use your test user account (sdeepsm@gmail.com) with override grants via the feedback endpoint. Or temporarily raise limit in Worker for your user ID during development. |
| Feature branch conflicts during merge | Low | Medium | Merge each branch to main immediately after testing. Do not let multiple branches diverge for more than 2-3 days. |

---

## 15. Success Criteria

### V1.5 is complete when:

**For the image expiry fix:**
- Zero new images stored as CDN URLs in Supabase
- All new generations load from R2 paths

**For domain-based character creation:**
- A reseller can create a reseller character with store-appropriate DNA
- System prompt for reseller sounds fundamentally different from educator

**For the attachment system:**
- A reseller attaches a product image and gets a photo of themselves with the product
- An educator attaches a reference image and gets content in that mood/style

**For offer pills:**
- A reseller creates 3 offers, uses each in under 5 seconds from chat

**For background generation:**
- User submits generation, closes tab, returns in 2 minutes, sees completed image

**For prompt preview:**
- User with toggle ON sees modal before every generation
- User with toggle OFF sees no change from V1 behavior

### Target User Metric

A WhatsApp reseller can go from opening the app to having a product post ready to share in under 5 minutes, without filling any form twice.

---

## Opening Prompt for V1.5 Build Sessions

Paste this at the start of each Claude Code session:

```
You are the Backend/Frontend Agent for PersonalityOS V1.5.

Stack: Next.js 16, TypeScript, Tailwind, shadcn/ui (frontend)
       Cloudflare Workers + Hono (backend)
       Supabase PostgreSQL (database)
       Cloudflare R2 (storage)
       MuAPI (image generation)

Live URL: https://personalityos-d1x.pages.dev
Worker URL: https://personalityos-api.sdeepms.workers.dev
Local path: D:\Projects\PersonalityOS\personalityos

V1.5 Architecture Document: PERSONALITYOS_V1.5_ARCHITECTURE.md
V1 Handoff Document: PERSONALITYOS_V1_HANDOFF.md

Read both documents before starting.

Today I am building: [ITEM NAME — e.g. "Item 1: Fix Image Expiry"]
Working on branch: [feature/v1.5-image-expiry]

Current task: [specific task description]

Do not touch any V1 code outside the scope of today's task.
```

---

*Document version: 1.5.0*
*Generated: June 2026*
*Status: Architecture finalized — Ready for implementation*
