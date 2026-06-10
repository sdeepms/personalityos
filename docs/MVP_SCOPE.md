# PersonalityOS — MVP Scope (Version 1)

**Version:** 1.0 Final
**Last Updated:** June 2026

---

## What V1 Must Prove

> **A user creates a character once, uploads one reference photo, and from that day forward generates consistent images and social-ready captions for any platform — in that character's face and voice — without ever re-explaining anything.**

That sentence is the entire MVP contract. Every feature decision flows from it.

---

## Ravi's Journey — The Design Standard

Ravi wants to create an AI character called "Arjun" for his UPSC content on Instagram and LinkedIn.

```
Ravi opens PersonalityOS → signs up → lands on dashboard
        │
        ▼
Dashboard shows: "Create your first character"
Ravi clicks it
        │
        ▼
Identity form (visual cards, not plain dropdowns):
  Name:         Arjun
  Domain:       UPSC — Indian Polity & Constitutional Law
  Gender:       Male
  Age Range:    30s
  Nationality:  Indian
  Style preset: Engaging Explainer
                (conversational, example-heavy, energetic)
        │
        ▼
Ravi uploads one photo — a face he likes
(front portrait, clean background)
System stores it as Arjun's primary reference image

System assembles Arjun's Digital DNA:
  visual_style_prompt: "Indian male, early 30s, professional
    educator, warm tone, academic setting"
  system_prompt:       Arjun's complete character prompt
  prompt_dna:          style modifiers, negative prompts,
                       aspect preferences per platform
        │
        ▼
Arjun's card appears on dashboard.
Ravi clicks "Open Chat"
        │
        ▼
Chat Studio opens.

Above the input, platform shortcuts:
  [ Instagram Post ]  [ LinkedIn Post ]  [ X Thread ]
  [ Carousel ]  [ Story ]

Ravi clicks "Instagram Post"
Chat pre-fills: "Create an Instagram post about:"
Ravi types: "Emergency Provisions under Article 352"
Ravi hits send
        │
        ▼
System responds in ~15 seconds with a structured package:

  📝 CAPTION
  [Instagram-ready caption, 180 words, Arjun's voice,
   conversational, example-heavy, ends with question,
   5 relevant hashtags]

  🖼️ IMAGE
  [Arjun generated — teaching pose, whiteboard context,
   consistent face, 1:1 aspect ratio for Instagram feed]

  📋 SPECS
  Platform: Instagram  |  Format: 1:1  |  Ready to post
        │
        ▼
Ravi reads the caption. Edits one sentence.
Downloads the image. Copies the caption.
Opens Instagram. Posts.

Total time: 12 minutes from signup to first posted content.
        │
        ▼
NEXT DAY:
Ravi opens PersonalityOS → clicks Arjun → types new topic
Same face. Same voice. Same 12-second generation.
No re-explaining. No re-uploading.
        │
        ▼  ← This is what we are building
```

---

## The Six V1 Flows

```
Flow 1:  Create Character (Digital DNA)
Flow 2:  Upload Reference Image
Flow 3:  Open Chat Studio
Flow 4:  Generate Social Post (caption + image together)
Flow 5:  Asset Library (browse, download, reuse)
Flow 6:  Multi-Character Dashboard
```

---

## Flow 1 — Create Character

**User action:** Fills a visual card-based form. Not plain text dropdowns.

Fields:
- Name (text input)
- Domain (text input with quick-select chips: UPSC / Finance / Startup / Coaching / History / Ethics / Other)
- Gender (card: Male / Female / Neutral)
- Age Range (card: 20s / 30s / 40s+)
- Nationality (card: Indian + text for other)
- Style Preset (card — 3 options derived from domain + age selections):
  - Academic Accessible: formal, structured, precise
  - Engaging Explainer: conversational, example-heavy, energetic
  - Direct Mentor: authoritative, brief, no-nonsense

**System action:**
- Saves character to Supabase `characters` table
- Assembles `system_prompt` from all fields
- Assembles `visual_style_prompt`: "{nationality} {gender}, {age_range}, {domain_context}, professional, natural lighting"
- Builds `prompt_dna` JSON with defaults:
  - `style_modifiers`: ["professional portrait", "cinematic lighting", "sharp focus"]
  - `negative_prompt`: "cartoon, anime, blurry, low quality, deformed, watermark"
  - `aspect_preferences`: {"instagram": "1:1", "story": "9:16", "linkedin": "4:5", "x": "16:9", "reel": "9:16"}
  - `color_palette`: derived from nationality + domain
- Sets `reference_images_ready: false`, `dna_ready: true`

**Done when:** Character card appears on dashboard.

---

## Flow 2 — Upload Reference Image

**User action:** After character creation, prompted: "Give Arjun a face."

Two paths:

**Path A — Upload (preferred for real users):**
User uploads 1–5 photos. Minimum: 1 front portrait.
Optional additional poses: side, angled, backside, expertise-specific (educator at whiteboard, advisor with charts).
Each upload gets a pose label.

**Path B — AI Generate (for fully AI characters):**
User clicks "Generate from description."
System calls Provider Adapter → `generateImage()` with visual_style_prompt.
Generates a front portrait from the character's DNA parameters.
Stores as the primary reference image.

**System action:**
- Stores all uploaded/generated images in R2: `identity/{userId}/{characterId}/ref_{timestamp}_{pose}.jpg`
- Saves URL array to `characters.reference_image_urls` JSON field
- First image marked `is_primary: true`
- Sets `reference_images_ready: true`

**Done when:** Character card shows the reference portrait thumbnail.

---

## Flow 3 — Chat Studio

**User action:** Clicks "Open Chat" on any character card.

**What they see:**
- Character header: Arjun's portrait + name + domain
- Platform shortcuts above input: Instagram Post / LinkedIn Post / X Thread / Carousel / Story
- Chat input: "Ask Arjun to create content..."
- Previous generations shown as chat history below

**How shortcuts work:**
Each shortcut pre-fills a structured message:
- Instagram Post → "Create an Instagram post about: [cursor]"
- LinkedIn Post → "Create a LinkedIn post about: [cursor]"
- X Thread → "Create an X thread about: [cursor]"

User can also type freely without using shortcuts.

**Done when:** User can open chat for any character and type a request.

---

## Flow 4 — Generate Social Post

This is the core flow. Caption + image generated together.

**User sends:** "Create an Instagram post about Emergency Provisions"

**System pipeline:**

Step 1 — LLM generates the structured response:

```
POST /api/chat
Input: { character_id, message, platform: "instagram" }

Worker:
1. Fetch character from Supabase (system_prompt, prompt_dna, visual_style_prompt)
2. Call LLM with:
   System: [character.system_prompt + platform format rules]
   User:   [message]
   Output format: JSON {
     caption: string,
     image_description: string,
     platform: string,
     hashtags: string[]
   }
3. Return structured JSON to frontend instantly (~3-5 seconds)
```

Step 2 — Frontend triggers image generation:

```
POST /api/generate/image
Input: {
  character_id,
  image_description: from LLM response,
  platform: "instagram"
}

Worker:
1. Fetch character (reference_image_urls, visual_style_prompt, prompt_dna)
2. Assemble full image prompt:
   "[image_description]. [visual_style_prompt].
    [prompt_dna.style_modifiers joined]. [prompt_dna.color_palette]"
   Negative: [prompt_dna.negative_prompt]
   References: [primary reference image URL]
   Aspect: [prompt_dna.aspect_preferences.instagram]
3. Call Provider Adapter → generateImage()
4. Download result → store in R2: generations/{userId}/{characterId}/{genId}.png
5. Save generation record to Supabase
6. Return R2 URL (~15-25 seconds for Flux Dev via MuAPI)
```

**Progressive reveal in UI:**
- Immediately: caption appears and is readable
- Simultaneously: image generation starts, placeholder shown
- ~20 seconds later: image replaces placeholder
- User can read, edit, copy caption while image generates

**Saves to library automatically.** User never manually saves anything.

**Platform formatting rules per platform:**

Instagram Post:
- Caption: 150–220 words, hook first line, emojis used naturally, 5–7 hashtags at end
- Image aspect: 1:1

LinkedIn Post:
- Caption: 200–400 words, strong opinion or insight as first line, no hashtags in body, 3–5 hashtags at very end, personal + professional tone
- Image aspect: 4:5

X Thread:
- 5–7 tweets, each under 280 characters, numbered 1/7, hook on tweet 1, CTA on last tweet
- Image aspect: 16:9 (for tweet 1 only, rest is text)

Carousel:
- 5–7 slide captions, each one punchy sentence, builds on previous
- Image: generates slide 1 image only in V1

Story:
- Caption: 50–80 words, very punchy, single clear point
- Image aspect: 9:16

**Done when:** Caption appears immediately, image appears within 30 seconds, both save to library.

---

## Flow 5 — Asset Library

**User action:** Clicks "Library" on any character card.

**What they see:**
- All generations for this character, newest first
- Toggle: All / Images / Captions
- Each card shows: thumbnail (for images), first 80 chars (for text), platform badge, date
- Click → opens full view: full caption + full image + download buttons
- Download text as .txt, image as .png
- Copy caption to clipboard in one click

**Done when:** All past generations are visible, downloadable, and organised by character.

---

## Flow 6 — Multi-Character Dashboard

**User action:** Opens PersonalityOS home.

**What they see:**
- Grid of character cards
- Each card: character portrait, name, domain, generation count, last used date
- "Create New Character" button always visible
- Clicking any card → opens that character's Chat Studio

**No limit on number of characters in V1.** A user can have 10 characters if they want.

**Done when:** Dashboard shows all characters, each clickable, each isolated.

---

## The Prompt DNA — How Characters Stay Consistent

This is the technical mechanism behind visual consistency. Every character has a `prompt_dna` JSON field:

```json
{
  "style_modifiers": [
    "professional portrait photography",
    "cinematic lighting",
    "sharp focus",
    "high detail"
  ],
  "negative_prompt": "cartoon, anime, blurry, low quality, deformed, extra limbs, watermark, text overlay",
  "color_palette": "warm academic tones, earth colors, professional",
  "aspect_preferences": {
    "instagram": "1:1",
    "linkedin": "4:5",
    "x": "16:9",
    "story": "9:16",
    "reel": "9:16",
    "carousel": "1:1"
  },
  "provider_overrides": {
    "muapi": {
      "model": "flux-dev",
      "steps": 28
    }
  }
}
```

Users can edit `style_modifiers` and `color_palette` via simple UI controls (sliders, tag inputs) in character settings. They never see the raw JSON.

Every image generation assembles:
```
[user's scene description]
[character.visual_style_prompt]
[prompt_dna.style_modifiers]
[prompt_dna.color_palette]
Reference images: [character.reference_image_urls primary]
Negative: [prompt_dna.negative_prompt]
Aspect: [prompt_dna.aspect_preferences[platform]]
Model: [prompt_dna.provider_overrides.muapi.model]
```

This is deterministic. Tuesday's Arjun looks the same as Thursday's Arjun because the same DNA drives every prompt.

---

## What Is NOT in V1

| Feature | Version |
|---|---|
| Voice / audio of any kind | V3 |
| Video generation | V2 |
| Direct social media posting (OAuth) | V2 |
| Template catalog (pre-built characters to buy) | V3 |
| Marketplace (buy/sell characters) | V4 |
| Knowledge upload (PDFs, notes, RAG) | Post-V1 if validated |
| Payments / Stripe | After 50 paying users show up |
| Multi-stage LLM pipeline | V2.5 |
| Analytics dashboard | Post-V1 |
| Mobile app | V3 |
| Team / collaboration | V4 |

---

## V1 Success Criteria

| What to measure | Target |
|---|---|
| Time from signup to first generated post | Under 15 minutes |
| Visual consistency: same character across 10 images | Recognisably same face |
| Caption sounds like the character (not generic AI) | User says "yes" when asked |
| Image generation time | Under 30 seconds |
| Caption generation time | Under 8 seconds |
| D7 retention (users who return on day 7) | > 30% |
| Generations per character per week | > 5 |

---

## Tech Stack — Final for V1

| Layer | Choice | Cost |
|---|---|---|
| Frontend | Next.js 14 + Tailwind + shadcn/ui | Free |
| Backend | Cloudflare Workers + Hono | Free (100K req/day) |
| Database | Supabase PostgreSQL | Free (500MB) |
| Auth | Supabase Auth | Free |
| File Storage | Cloudflare R2 | Free (10GB) |
| LLM — free users | Qwen3 32B via OpenRouter | Free tier |
| LLM — paid users | Claude Sonnet via Vercel AI SDK | ~₹800/100 users |
| Image generation | MuAPI → Flux Dev (Provider Adapter) | ~₹1,200/400 images |
| Analytics | PostHog | Free (1M events) |
| **Total infrastructure** | | **~₹2,000/month at 100 users** |
