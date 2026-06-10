# PersonalityOS — Database Schema (V1)

**Version:** 1.0 Final — simplified for fastest build
**Database:** Supabase PostgreSQL only
**Last Updated:** June 2026

---

## Architecture Decision: One Database

V1 uses Supabase for everything. One connection string. One dashboard. One query language.

No Cloudflare D1. No pgvector. No Redis. No second database of any kind.

**Why not D1?**
D1 has zero-latency benefit that is invisible when the same request also calls MuAPI (15–25s) and an LLM (3–5s). The simplicity of one database vastly outweighs the marginal latency gain of D1 for a V1 product.

**Why not pgvector?**
V1 has no knowledge upload, no RAG pipeline, no document chunking. There is nothing to embed or search semantically. pgvector is a V2+ concern.

**Migration path:**
When V1 has users and revenue, consider moving structured data to D1 for edge performance. When V2 adds knowledge upload, add pgvector. Until then, Supabase free tier (500MB) is more than sufficient.

---

## Three Tables. That Is It.

```
Supabase Auth   → manages users (built-in, no custom table needed)
characters      → Digital DNA for every AI character
generations     → every piece of generated content
```

No templates table. No knowledge tables. No voice tables. No payment tables.
Those come in future versions.

---

## Table 1: `characters`

One row per AI character. This is the entire Digital DNA record.

```sql
CREATE TABLE characters (

  -- Primary key
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

  -- Owner (from Supabase Auth JWT — never from request body)
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Identity Layer
  name            TEXT NOT NULL,
  -- "Arjun"

  domain          TEXT NOT NULL,
  -- "UPSC — Indian Polity & Constitutional Law"

  gender          TEXT,
  -- "male" | "female" | "neutral"

  age_range       TEXT,
  -- "20s" | "30s" | "40s+"

  nationality     TEXT,
  -- "Indian"

  style_preset    TEXT DEFAULT 'engaging_explainer',
  -- "academic_accessible" | "engaging_explainer" | "direct_mentor"

  -- Generated assets (assembled from identity fields above)

  system_prompt   TEXT,
  -- The master character prompt sent to LLM before every generation.
  -- Example: "You are Arjun, a UPSC educator known for Indian Polity.
  -- You are an Indian male in your early 30s. Your style is conversational
  -- and example-heavy. You make complex constitutional topics accessible
  -- through real-world examples and analogies..."

  visual_style_prompt TEXT,
  -- Short descriptor for image generation.
  -- Example: "Indian male, early 30s, professional educator,
  --           warm tone, academic setting, natural lighting"

  prompt_dna      TEXT DEFAULT '{}',
  -- JSON string containing:
  -- {
  --   "style_modifiers": ["professional portrait", "cinematic lighting", "sharp focus"],
  --   "negative_prompt": "cartoon, anime, blurry, low quality, deformed, watermark",
  --   "color_palette": "warm academic tones, earth colors",
  --   "aspect_preferences": {
  --     "instagram": "1:1",
  --     "linkedin": "4:5",
  --     "x": "16:9",
  --     "story": "9:16",
  --     "reel": "9:16",
  --     "carousel": "1:1"
  --   },
  --   "provider_overrides": {
  --     "muapi": { "model": "flux-dev", "steps": 28 }
  --   }
  -- }

  reference_image_urls TEXT DEFAULT '[]',
  -- JSON array of R2 paths + metadata:
  -- [
  --   {
  --     "url": "identity/user123/char456/ref_1700000000_front.jpg",
  --     "pose_type": "front",
  --     "is_primary": true
  --   },
  --   {
  --     "url": "identity/user123/char456/ref_1700000001_side.jpg",
  --     "pose_type": "side",
  --     "is_primary": false
  --   }
  -- ]
  -- pose_type options: "front" | "side" | "angled" | "backside"
  --                    | "expertise_specific" | "other"

  -- Status flags
  dna_ready              INTEGER DEFAULT 0,
  -- 1 = system_prompt and prompt_dna assembled

  reference_images_ready INTEGER DEFAULT 0,
  -- 1 = at least one reference image uploaded or generated

  -- Soft delete
  is_active       INTEGER DEFAULT 1,

  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index: fetch all characters for a user (dashboard load)
CREATE INDEX idx_characters_user ON characters(user_id);

-- Index: active characters only
CREATE INDEX idx_characters_active ON characters(user_id, is_active);
```

**Row Level Security:**
```sql
ALTER TABLE characters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own characters"
  ON characters FOR ALL
  USING (auth.uid() = user_id);
```

---

## Table 2: `generations`

One row per generated output. Text and images both stored here.

```sql
CREATE TABLE generations (

  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,

  -- Links
  character_id    TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What type of generation is this?
  generation_type TEXT NOT NULL,
  -- "text" | "image"
  -- "video" and "audio" reserved for future versions

  -- Which platform was this generated for?
  platform        TEXT,
  -- "instagram" | "linkedin" | "x" | "carousel" | "story" | "general"

  -- User's original request
  user_prompt     TEXT NOT NULL,
  -- "Create an Instagram post about Emergency Provisions"

  -- Outputs (only relevant field populated per type)
  text_output     TEXT,
  -- For generation_type = "text":
  -- The full caption/script/thread as generated

  image_url       TEXT,
  -- For generation_type = "image":
  -- R2 path: generations/{userId}/{characterId}/{generationId}.png

  -- Provider tracking (script-writer for text, image provider for image)
  provider        TEXT,
  -- "qwen3_32b" | "claude_sonnet" | "muapi" | "fal"

  model_used      TEXT,
  -- "qwen/qwen3-32b" | "claude-sonnet-4-5" | "flux-dev" | "flux-schnell"

  -- Performance tracking
  generation_time_ms INTEGER,

  -- Cost tracking (for future monetisation decisions)
  cost_usd_cents  INTEGER DEFAULT 0,

  -- Status
  status          TEXT DEFAULT 'completed',
  -- "pending" | "generating" | "completed" | "failed"

  error_message   TEXT,

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Index: asset library (all generations for a character, newest first)
CREATE INDEX idx_generations_character ON generations(character_id, created_at DESC);

-- Index: user's full history across all characters
CREATE INDEX idx_generations_user ON generations(user_id, created_at DESC);

-- Index: filter by type (images only, text only)
CREATE INDEX idx_generations_type ON generations(character_id, generation_type);
```

**Row Level Security:**
```sql
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own generations"
  ON generations FOR ALL
  USING (auth.uid() = user_id);
```

---

## Supabase Auth (Built-In, No Custom Table)

Supabase Auth manages the `auth.users` table automatically. It provides:
- Email + password signup and login
- JWT token issuance (used by every API call)
- Session management

The Worker reads `user_id` from the verified JWT only. It never accepts `user_id` from the request body.

No custom `users` table is needed in V1. If user profile data is needed later (display name, avatar, plan tier), a `user_profiles` table referencing `auth.users.id` can be added without touching existing tables.

---

## Cloudflare R2 Storage (Not a Database Table)

Large files live in R2. The database stores only the R2 path (a short text string).

**Path conventions:**

```
personalityos-storage (R2 bucket)

Reference images (uploaded or AI-generated by user):
  identity/{userId}/{characterId}/ref_{timestamp}_{poseType}.jpg

Generated images (output from MuAPI/FAL):
  generations/{userId}/{characterId}/{generationId}.png
```

R2 paths stored in:
- `characters.reference_image_urls` JSON array — reference images
- `generations.image_url` TEXT field — generated image

**Why R2 and not Supabase Storage?**
R2 is free up to 10GB with zero egress fees. Every image served to the user costs nothing. Supabase Storage charges for bandwidth. At scale this matters significantly.

---

## Future Tables (Defined Now, Not Created)

These tables will be needed in future versions. Defining their shape now prevents schema conflicts when the time comes.

**V2 — Video generations:**
```sql
-- Add to generations table:
ALTER TABLE generations ADD COLUMN video_url TEXT;
-- generation_type gains "video" as a valid value
```

**V3 — Voice DNA:**
```sql
CREATE TABLE voice_profiles (
  id              TEXT PRIMARY KEY,
  character_id    TEXT REFERENCES characters(id) ON DELETE CASCADE,
  user_id         UUID REFERENCES auth.users(id),
  provider        TEXT,       -- "elevenlabs" | "cartesia"
  provider_voice_id TEXT,     -- ID returned by the voice provider
  voice_sample_url TEXT,      -- R2 path to the sample audio (if cloned)
  voice_params    TEXT,       -- JSON: age, gender, energy, accent
  status          TEXT DEFAULT 'pending',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**V3 — Templates catalog:**
```sql
CREATE TABLE templates (
  id          TEXT PRIMARY KEY,
  title       TEXT,
  domain      TEXT,
  price_inr   INTEGER DEFAULT 0,
  dna_config  TEXT,  -- JSON: default DNA values for this template
  is_active   INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**V4 — Marketplace:**
```sql
CREATE TABLE marketplace_listings (
  id              TEXT PRIMARY KEY,
  character_id    TEXT REFERENCES characters(id),
  seller_id       UUID REFERENCES auth.users(id),
  price_inr       INTEGER,
  status          TEXT DEFAULT 'draft',
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE purchases (
  id              TEXT PRIMARY KEY,
  buyer_id        UUID REFERENCES auth.users(id),
  listing_id      TEXT REFERENCES marketplace_listings(id),
  amount_inr      INTEGER,
  stripe_id       TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

None of these are created in V1. They are documented here to prevent future migrations that would conflict with the current schema.

---

## SQL Migration — Complete V1 Schema

Run this in Supabase SQL Editor on Day 2 of the build plan.

```sql
-- Table: characters
CREATE TABLE characters (
  id                     TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  user_id                UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  domain                 TEXT NOT NULL,
  gender                 TEXT,
  age_range              TEXT,
  nationality            TEXT,
  style_preset           TEXT DEFAULT 'engaging_explainer',
  system_prompt          TEXT,
  visual_style_prompt    TEXT,
  prompt_dna             TEXT DEFAULT '{}',
  reference_image_urls   TEXT DEFAULT '[]',
  dna_ready              INTEGER DEFAULT 0,
  reference_images_ready INTEGER DEFAULT 0,
  is_active              INTEGER DEFAULT 1,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_characters_user   ON characters(user_id);
CREATE INDEX idx_characters_active ON characters(user_id, is_active);

ALTER TABLE characters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own characters"
  ON characters FOR ALL USING (auth.uid() = user_id);

-- Table: generations
CREATE TABLE generations (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  character_id       TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type    TEXT NOT NULL,
  platform           TEXT,
  user_prompt        TEXT NOT NULL,
  text_output        TEXT,
  image_url          TEXT,
  provider           TEXT,
  model_used         TEXT,
  generation_time_ms INTEGER,
  cost_usd_cents     INTEGER DEFAULT 0,
  status             TEXT DEFAULT 'completed',
  error_message      TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_generations_character ON generations(character_id, created_at DESC);
CREATE INDEX idx_generations_user      ON generations(user_id, created_at DESC);
CREATE INDEX idx_generations_type      ON generations(character_id, generation_type);

ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own generations"
  ON generations FOR ALL USING (auth.uid() = user_id);
```

---

## Cost at V1 Scale (100 Users, 3 Months)

| Item | Estimate | Cost |
|---|---|---|
| Supabase free tier | 500MB, 2 tables, 100 users | ₹0 |
| characters rows | ~300 rows (3 chars per user avg) | Negligible |
| generations rows | ~15,000 rows (50 per user avg) | ~5MB |
| R2 reference images | ~300 images × 500KB avg | ~150MB → ₹0 |
| R2 generated images | ~15,000 images × 300KB avg | ~4.5GB → ₹0 |
| **Total database + storage** | | **₹0** |

The entire data layer is free for V1 scale. Costs only appear in AI generation (MuAPI, LLM).
