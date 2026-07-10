# PersonalityOS — V2 Architecture Document

**Version:** 2.0  
**Status:** Pre-build — Architecture Finalized  
**Date:** July 2026  
**Previous Version:** V1.5 Live at https://personalityos-d1x.pages.dev  
**Author:** CTO Agent

---

## Table of Contents

1. [V2 Goals](#1-v2-goals)
2. [What Does Not Change](#2-what-does-not-change)
2a. [Creator DNA](#2a-creator-dna)
3. [Three-Tier Subscription System](#3-three-tier-subscription-system)
4. [The Complete Video Pipeline](#4-the-complete-video-pipeline)
5. [Reference Video System](#5-reference-video-system)
6. [Ultra Tier — Contextual Intro](#6-ultra-tier--contextual-intro)
7. [Agent Architecture](#7-agent-architecture)
8. [Cloudflare Queues — Background Processing](#8-cloudflare-queues--background-processing)
9. [Database Changes](#9-database-changes)
10. [Backend Routes — Complete Map](#10-backend-routes--complete-map)
11. [Provider Adapter Changes](#11-provider-adapter-changes)
12. [Frontend — New Pages](#12-frontend--new-pages)
13. [Creatomate Templates](#13-creatomate-templates)
14. [Tool Stack — Final Decisions](#14-tool-stack--final-decisions)
15. [Cost Model Per Tier](#15-cost-model-per-tier)
16. [Build Order — Day by Day](#16-build-order--day-by-day)
17. [Risk Register](#17-risk-register)
18. [Success Criteria](#18-success-criteria)
19. [Opening Prompt for V2 Build Sessions](#19-opening-prompt-for-v2-build-sessions)

---

## 1. V2 Goals

### Product Positioning

PersonalityOS V2 is positioned as an **AI Explainer Studio for Knowledge Creators** (transitioning from an AI Character Platform).

V2 has one sentence:

> **Give explaining creators — teachers, tech explainers, health influencers — a daily automated video pipeline where they input a topic, approve a script, and receive a production-ready branded video in under 20 minutes.**

### What V2 Proves

- A teacher can generate a 1-minute Hindi educational reel from a topic in under 20 minutes
- An AI news creator can generate a 2-minute English video daily without editing software
- A health explainer can produce consistent branded content without a video editor
- Users will pay ₹999-4999/month for this outcome

### What V2 Does NOT Do

- Auto-publishing to Instagram/YouTube (V3)
- Voice cloning (V3)
- User-defined editing workflows (V3)
- Payments/Razorpay (implement in first week of V2 alongside first feature)
- Long-form video > 3 minutes (V3)

### Target Users

The platform serves the following knowledge creators:
- **Teachers**
- **Tech educators**
- **Business mentors**
- **Finance educators**
- **Health explainers**
- **AI news creators**

---

## 2. What Does Not Change

Everything built in V1 and V1.5 remains untouched (excluding reseller features, which are removed from V2).

| Component | Status |
|---|---|
| Creator creation wizard | Unchanged — but extended with Option A/B onboarding in Step 3 |
| Supabase + Cloudflare Workers + Hono | Unchanged |
| R2 storage + presigned URLs | Unchanged |
| Library page with save system | Unchanged |
| Provider Adapter pattern | Extended with new video adapters |
| Auth system | Unchanged |
| Image generation pipeline | Unchanged |

V2 is **additive**. No existing feature is removed or broken.

---

## 2a. Creator DNA

Character DNA is renamed to **Creator DNA** in V2. It acts as the permanent creator profile and stores:
- **Face identity** (uploaded photos or reference frames)
- **Gemini Omni Character ID** (for contextual video generation)
- **Voice profile** (Sarvam AI TTS speaker profile)
- **Speaking pace** (speed modifier)
- **Teaching style** (instruction/style prompt presets)
- **Brand colours** (primary, secondary hex codes)
- **Camera framing** (close-up, medium-shot, talking head)
- **Gesture style** (subtle, energetic, lecturing)
- **Subtitle style** (font, animations, highlight color)
- **Editing template** (Creatomate template association)
- **Wardrobe presets** (outfit options depending on subscription tier)
- **Background presets** (studio, kitchen, office, etc.)
- **Logo** (branding overlay asset)
- **Intro** (cinematic parameters or template hooks)
- **Outro** (fixed outro video/card - stitched at the end of every video without regeneration)

---

## 3. Three-Tier Subscription System

### Standard — ₹999/month

| Feature | Detail |
|---|---|
| Videos per month | 30 |
| Max video length | 1 minute (~130 words) |
| Reference videos | 1 gesture video (loops seamlessly) |
| Wardrobe | 1 outfit preset |
| Pipeline | Creator DNA → Style Learning Agent → Research → Script → TTS → Video (Loop) → Editing (Creatomate with fixed outro) → QA Agent |
| Captions | Animated Hindi/English (Creatomate template) |
| Branding | Logo + channel name overlay |
| B-roll | ❌ |
| Music | Basic (Creatomate template) |
| Intro | ❌ Standard talking head start |
| Outro | ✅ Fixed outro card (stitched, no regeneration) |
| Download | ✅ |
| Auto-publish | ❌ (V3) |

### Pro — ₹2499/month

| Feature | Detail |
|---|---|
| Videos per month | 30 |
| Max video length | 2 minutes (~260 words) |
| Reference videos | 2 gesture videos (A+B alternating loop, supports dynamic wardrobe changes) |
| Wardrobe | 5 outfit presets |
| Pipeline | Creator DNA → Style Learning Agent → Research → Script → TTS → Video (Alternating loop/wardrobe swap) → Editing (Creatomate with fixed outro + Submagic) → QA Agent |
| Captions | Premium animated captions (Submagic style) |
| Branding | Full branded template |
| B-roll | ✅ AI auto B-roll (Submagic) |
| Music | ✅ AI auto-selected (Submagic) |
| Zoom effects | ✅ Auto-zoom (Submagic) |
| Intro | ❌ Standard talking head start |
| Outro | ✅ Fixed outro video (stitched, no regeneration) |
| Download | ✅ |
| Auto-publish | ❌ (V3) |

### Ultra — ₹4999/month

| Feature | Detail |
|---|---|
| Videos per month | 30 |
| Max video length | 3 minutes (~390 words) |
| Reference videos | 2 gesture videos (same as Pro, supports dynamic wardrobe changes) |
| Wardrobe | Unlimited outfit presets |
| Pipeline | Creator DNA → Style Learning Agent → Research → Script → TTS → Video (Gemini Omni Intro + Main alternating loop/wardrobe swap) → Editing (Creatomate with fixed outro + Submagic) → QA Agent |
| Captions | Premium animated captions |
| Branding | Full branded template |
| B-roll | ✅ |
| Music | ✅ |
| Zoom effects | ✅ |
| Intro | ✅ 5s Gemini Omni cinematic intro (creator inside topic context) |
| Hook line | ✅ Creator speaks one hook line in the intro |
| Outro | ✅ Fixed outro video (stitched, no regeneration) |
| Download | ✅ |
| Auto-publish | ❌ (V3) |

---

## 4. The Complete Video Pipeline

### Standard Tier Pipeline

```
USER INPUT
  Topic + Niche + Language (Hindi/English)
        ↓
AGENT 1: Style Learning Agent
  Loads Creator DNA presets (framing, pace, 1 outfit, fixed outro)
  Time: ~2-5 seconds
        ↓
AGENT 2: Research Agent
  Gemini 2.5 Flash + Google Search grounding
  Input: topic, niche
  Output: research_brief (5 key facts, angles, examples)
  Time: ~10-15 seconds
        ↓
AGENT 3: Script Agent
  Claude Sonnet + creator system_prompt + research_brief
  Input: research_brief, Creator DNA, target ~130 words
  Output: formatted script with intro/body sections (outro is fixed)
  Time: ~10-15 seconds
        ↓
USER APPROVAL GATE ← USER READS AND APPROVES SCRIPT
  UI: Script shown in full
  User can edit script before approving
  User clicks "Approve & Generate Video"
        ↓
[Job pushed to Cloudflare Queue — user can close tab]
        ↓
AGENT 4: TTS Agent (Queue Consumer)
  Sarvam AI Bulbul V3
  Input: approved script text, language code, speaker voice, pace preset
  Output: full_audio.mp3 → saved to R2
  Time: ~10-15 seconds for 1 minute of audio
        ↓
AGENT 5: Video Agent (Queue Consumer)
  Step 5a: Fetch reference gesture video from R2
  Step 5b: FFmpeg loop: gesture_video × N = audio_duration (max 1 minute)
  Step 5c: fal.ai LatentSync
    Input: looped_video + full_audio.mp3
    Output: lipsync_video.mp4 → saved to R2
  Time: ~20-30 seconds
        ↓
AGENT 6: Editing Agent (Queue Consumer)
  Creatomate (Standard template)
  Input: lipsync_video.mp4 + Creator DNA branding data + fixed outro (from Creator DNA)
  Operations:
    - Auto-transcribe + animated captions (Hindi or English)
    - Background overlay
    - Logo + channel name
    - Basic background music
    - Stitch fixed outro card (no regeneration)
  Output: edited_video.mp4 → saved to R2
  Time: ~15-20 seconds
        ↓
AGENT 7: QA Agent (Queue Consumer)
  Validates lipsync alignment, caption rendering, and presence of branding/outro
  Output: final_video.mp4 (approved) → saved to R2
  Time: ~5-10 seconds
        ↓
USER NOTIFICATION
  Dashboard: "Your video is ready"
  User previews → downloads
```

### Pro Tier Pipeline

```
[Steps 1-3 identical to Standard — Style Learning + Research + Script + Approval]
  NOTE: Script Agent targets ~260 words for 2 min video
        ↓
[Job pushed to Cloudflare Queue]
        ↓
AGENT 4: TTS Agent
  Sarvam AI Bulbul V3 → full_audio.mp3
        ↓
AGENT 5: Video Agent (Video Assembly)
  Step 5a: Fetch TWO reference gesture videos (A and B) from R2
           (Applies clothing changes across wardrobe presets while keeping identity)
  Step 5b: FFmpeg alternating loop:
    A (8-10s) + crossfade(0.5s) + B (8-10s) + crossfade(0.5s) + A...
    Loop until = audio_duration (max 2 minutes)
  Step 5c: fal.ai LatentSync
    Input: alternating_looped_video + full_audio.mp3
    Output: lipsync_video.mp4 → saved to R2
        ↓
AGENT 6: Editing Agent
  Step 6a: Creatomate (Pro template)
    - Animated captions
    - Premium background
    - Full branding
    - Transition effects
    - Stitch fixed outro video (from Creator DNA, no regeneration)
  Step 6b: Submagic API
    Input: creatomate_output.mp4
    Operations:
      - AI B-roll insertion (contextually relevant)
      - Auto-zoom effects at key moments
      - AI music selection + layering
      - Silence removal
    Output: edited_video.mp4 → saved to R2
        ↓
AGENT 7: QA Agent
  Validates lipsync quality, B-roll timing, subtitle accuracy, and final branding/outro.
  Output: final_video.mp4 → saved to R2
        ↓
USER NOTIFICATION → Preview → Download
```

### Ultra Tier Pipeline

```
[Steps 1-3 identical — Style Learning + Research + Script + Approval]
  NOTE: Script Agent targets ~390 words for 3 min video
  and also generates one hook line (15-20 words) for the contextual intro.
        ↓
[Job pushed to Cloudflare Queue]
        ↓
AGENT 4: TTS Agent
  Full script audio → full_audio.mp3
  Hook line audio → hook_audio.mp3 (separate, for intro)
        ↓
AGENT 5: Contextual Intro Agent (Ultra only)
  Gemini Omni via MuAPI
  Input:
    - creator_id (from gemini-omni-creator profile)
    - Reference photo
    - Topic + niche (to generate contextual scene)
    - hook_audio.mp3 (creator speaks this in intro)
  Output: intro_5s.mp4 → saved to R2
  Time: ~60-120 seconds
        ↓
AGENT 6: Video Agent (Main Video Assembly)
  [Same as Pro — alternating loop + LatentSync. Swaps clothes dynamically using unlimited wardrobe presets.]
  Output: main_lipsync.mp4
        ↓
AGENT 7: Editing Agent (Final Assembly)
  Creatomate (Ultra template)
  Input sequence:
    1. intro_5s.mp4 (Gemini Omni cinematic intro)
    2. crossfade transition (0.5s)
    3. main_lipsync.mp4 (full talking head video)
    4. fixed outro video (from Creator DNA) stitched at the end (no regeneration)
  Operations:
    - Stitch intro + main + fixed outro seamlessly
    - Apply captions (main video only, not intro/outro)
    - Full branding + logo
    - Premium background
  Output: assembled_video.mp4
        ↓
  Submagic (same as Pro):
    B-roll + zoom + music → edited_video.mp4
        ↓
AGENT 8: QA Agent
  Validates entire stitched sequence, intro visual quality, audio transitions, and branding guidelines.
  Output: final_video.mp4 → saved to R2
        ↓
USER NOTIFICATION → Preview → Download
```

---

## 5. Reference Video System

### What Reference Videos Are

A reference gesture video is an 8-10 second video of the creator making natural gestures, expressions, and head movements. It starts and ends at the same neutral pose so it can be looped seamlessly.

This video is generated or extracted ONCE during creator setup and stored permanently in R2. It is reused in every video generation. The lip sync is replaced each time by fal.ai LatentSync, so the original audio in the reference video does not matter.

### Onboarding Options (Step 3 of Creator Setup Wizard)

The platform supports two ways to initialize the Creator DNA:

#### Option A: Generate Creator DNA from Uploaded Photos
The user uploads reference photos. The system generates the gesture videos and defaults:
- **Standard**: Generates ONE gesture video (8-10s) of the creator making natural, conversational gestures.
- **Pro/Ultra**: Generates TWO gesture videos (A and B) representing different gesture directions for alternating loops.
- **Wardrobe generation**: Generates gesture videos using the user's wardrobe preset selections (1 outfit for Standard, up to 5 for Pro, and unlimited for Ultra).
- All visual settings are saved to the **Creator DNA** profile.

#### Option B: Upload Existing Explainer Video
The user uploads a 15-60s existing explainer video file. The **Style Learning Agent** analyzes the video and automatically extracts:
- **framing** (e.g. medium, close-up)
- **gestures** (style, frequency)
- **speaking speed** (words per minute pace)
- **clothing** (style, color palette to generate wardrobe presets)
- **editing style** (pacing, cuts)
- **subtitle style** (font, placement, highlights)
- **pacing** (timing of pauses)
These extracted parameters are saved into the **Creator DNA** as the permanent profile. The agent also crops and extracts reference gesture loops directly from the video to serve as R2 assets:
`avatars/{userId}/{creatorId}/gesture_a.mp4` (and `gesture_b.mp4` for Pro/Ultra).

### Wardrobe Presets & Clothing Changes
- **Standard**: 1 outfit preset stored.
- **Pro**: 5 outfit presets stored.
- **Ultra**: Unlimited outfit presets stored.

**Dynamic Outfit Swapping:**
For Pro and Ultra tiers, the Video Agent can automatically rotate or select different outfit presets (gesture video assets representing different clothing options) between video generations, adding variety to the channel while maintaining the creator's face and voice identity.

### The Seamless Loop — Technical Implementation

**Critical requirement:** Start frame = End frame.

**Implementation in Creatomate:**

Creatomate handles the looping and crossfade natively:

```json
{
  "elements": [{
    "type": "video",
    "source": "gesture_a_outfit1.mp4",
    "loop": true,
    "duration": "audio_duration",
    "trim_duration": 0.5,
    "transition": {
      "type": "crossfade",
      "duration": 0.5
    }
  }]
}
```

For Pro/Ultra alternating loop, Creatomate sequences A and B (with selected outfit):

```json
{
  "elements": [
    {
      "type": "video",
      "source": "gesture_a_outfit2.mp4",
      "loop": true,
      "segment_duration": 8,
      "transition": {"type": "crossfade", "duration": 0.5}
    },
    {
      "type": "video", 
      "source": "gesture_b_outfit2.mp4",
      "loop": true,
      "segment_duration": 8,
      "transition": {"type": "crossfade", "duration": 0.5}
    }
  ],
  "alternate": true,
  "total_duration": "audio_duration"
}
```

---

## 6. Ultra Tier — Contextual Intro

### What It Is

A 5-second cinematic video generated by Gemini Omni for each video. The creator appears inside the topic's visual context and speaks one hook line.

### Hook Line Generation

The Script Agent generates two outputs for Ultra:

```
Output 1: Full script (~700 words)
Output 2: Hook line (15-20 words, first-person, dramatic)

Examples:
  Topic: "Article 370 removal"
  Hook: "The most controversial decision in modern Indian 
         history — and why it still divides us."

  Topic: "GPT-5 capabilities"
  Hook: "The AI that just changed everything. Here's what 
         nobody is telling you."

  Topic: "Monsoon immunity tips"
  Hook: "Three things destroying your immunity this monsoon 
         — and the fix takes 5 minutes."
```

### Contextual Scene Prompt Assembly

The system assembles the Gemini Omni prompt automatically from topic + niche:

```typescript
function buildUltraIntroPrompt(
  topic: string,
  niche: string,
  hookLine: string,
  creator: CreatorDNA
): string {
  const sceneContext = inferSceneFromTopic(topic, niche)
  // UPSC + Article 370 → "Indian parliament building interior"
  // AI news + GPT-5 → "futuristic server room with blue lighting"
  // Health + monsoon → "bright wellness kitchen with herbs"
  
  return `${creator.nationality} ${creator.gender} educator/creator 
  stands confidently in ${sceneContext}. 
  They look directly at camera and speak: "${hookLine}"
  Cinematic lighting. The environment reflects the topic: ${topic}.
  Duration: exactly 5 seconds. 
  Creator returns to starting pose by final frame.
  Professional content creator energy. No text overlays.`
}
```

### Gemini Omni API Call

```typescript
POST /api/v1/gemini-omni  (via MuAPI)
{
  "prompt": assembledIntroPrompt,
  "creator_ids": [creator.gemini_character_id],
  "audio_ids": [hookAudioId],  // Sarvam-generated hook audio
  "aspect_ratio": "9:16",
  "duration": 5
}
}
```

### Joining Intro + Main Video + Outro

Creatomate Ultra template sequences:

```
[intro_5s.mp4] → [crossfade 0.5s] → [main_lipsync.mp4] → [crossfade 0.5s] → [fixed_outro.mp4]
```

The intro has its own audio (hook line spoken by creator).
The main video has the full script audio synced via LatentSync.
The outro uses the fixed pre-recorded or static card outro (from Creator DNA) and does not need to be regenerated.
Creatomate handles audio mixing — no overlap.

---

## 7. Agent Architecture

Each agent is a separate function in the Queue Consumer Worker. They run sequentially in one queue job. If any agent fails, the job is marked failed with the specific step that failed — the user can retry from that step.

```typescript
// workers/video-consumer/src/index.ts

interface VideoJob {
  job_id: string
  creator_id: string
  user_id: string
  tier: 'standard' | 'pro' | 'ultra'
  topic: string
  niche: string
  language: 'hi-IN' | 'en-IN'
  approved_script: string
  hook_line?: string  // ultra only
  status: VideoJobStatus
  current_step: string
  error_message?: string
}

type VideoJobStatus = 
  'pending' | 'style_learning' | 'researching' | 'scripting' | 
  'awaiting_approval' | 'approved' | 
  'generating_tts' | 'generating_intro' |
  'assembling_video' | 'editing_video' | 'qa_validation' |
  'completed' | 'failed'

// Agent functions called in sequence:
async function runStyleLearningAgent(job: VideoJob): Promise<StyleConfig>
async function runResearchAgent(job: VideoJob, style: StyleConfig): Promise<ResearchBrief>
async function runScriptAgent(job: VideoJob, brief: ResearchBrief, style: StyleConfig): Promise<Script>
// [PAUSE — user approves script]
async function runTTSAgent(job: VideoJob, style: StyleConfig): Promise<AudioUrls>
async function runIntroAgent(job: VideoJob, style: StyleConfig): Promise<string>  // ultra only
async function runVideoAgent(job: VideoJob, style: StyleConfig): Promise<string>
async function runEditingAgent(job: VideoJob, style: StyleConfig): Promise<string>
async function runQAAgent(job: VideoJob, videoUrl: string): Promise<string>
```

### Agent: Style Learning Agent

```typescript
// Loads the permanent Creator DNA profile and adapts it to the generation pipeline context.
// During onboarding Option B, extracts style parameters from an uploaded explainer video.
// Input: Creator DNA, (uploaded video file for onboarding)
// Output: StyleConfig JSON
```
During onboarding Option B, the agent extracts:
- `framing`: Close-up, medium, etc.
- `gestures`: Style, frequency.
- `speaking_speed`: Words per minute.
- `clothing`: Color and style to generate wardrobe options.
- `editing_style`: Cuts, transition speeds.
- `subtitle_style`: Captions font, placement, highlights.
- `pacing`: Silence distribution and timing.

### Agent: Research Agent

```typescript
// Uses Gemini 2.5 Flash with web search grounding
// Input: topic, niche, language
// Output: research_brief JSON

const researchPrompt = `
Research this topic for a ${niche} content creator: "${topic}"

Find:
1. The most important fact or development (1-2 sentences)
2. A surprising angle or lesser-known insight
3. A relatable real-world example for Indian audience
4. One statistic or data point if available
5. A practical takeaway or action item for the viewer

Language context: Content will be in ${language === 'hi-IN' ? 'Hindi' : 'English'}
Keep research concise. Return as JSON with keys: 
main_fact, surprising_angle, example, statistic, takeaway
`
```

### Agent: Script Agent

```typescript
// Uses Claude Sonnet with creator system_prompt
// Input: research_brief, Creator DNA, word_count target
// Output: formatted script (No dynamic outro generation)

const scriptPrompt = `
You are ${creator.name}. ${creator.system_prompt}

Write a ${wordCount}-word video script on: "${topic}"

Research brief: ${JSON.stringify(researchBrief)}

Script format:
INTRO (15-20 seconds): Hook the viewer. Start with the most 
surprising fact or question. Do not say "Hello" or introduce yourself.

MAIN CONTENT (main body): Cover the topic in your authentic voice.
Use the research brief. Speak conversationally, not academically.
${language === 'hi-IN' ? 'Write in Hindi. Technical terms can be English.' : 'Write in English with Indian context.'}

Return ONLY the script text. No stage directions. No [PAUSE] markers.
Do NOT write an outro or sign-off call-to-action (the outro is fixed and will be appended automatically).
Target exactly ${wordCount} words.
`

// Word count targets:
// Standard: 130 words ≈ 1 minute at normal pace
// Pro: 260 words ≈ 2 minutes at normal pace
// Ultra: 390 words ≈ 3 minutes at normal pace
```

### Agent: TTS Agent

```typescript
// Sarvam AI Bulbul V3
// Input: script text, language code, speaker voice, pace
// Output: audio file URL in R2

POST https://api.sarvam.ai/text-to-speech
{
  "inputs": [scriptText],
  "target_language_code": job.language,  // "hi-IN" or "en-IN"
  "speaker": selectSpeaker(creator),     // based on gender + style
  "model": "bulbul:v3",
  "pace": creator.speaking_pace || 0.95,  // dynamically loaded from Creator DNA
  "loudness": 1.5
}
```

### Agent: Contextual Intro Agent (Ultra only)

```typescript
// Gemini Omni via MuAPI
// Input: creator_id, hook_audio, topic, niche
// Output: 5s intro video URL

// Step 1: Generate hook audio via Sarvam
POST https://api.sarvam.ai/text-to-speech
{ "inputs": [hookLine], "model": "bulbul:v3", ... }

// Step 2: Generate intro video via Gemini Omni
POST https://api.muapi.ai/api/v1/gemini-omni
{
  "prompt": buildUltraIntroPrompt(topic, niche, hookLine, creator),
  "character_ids": [creator.gemini_character_id],
  "audio_ids": [hookAudioId],
  "aspect_ratio": "9:16",
  "duration": 5
}
```

### Agent: Video Agent

```typescript
// Step 1: Fetch gesture video(s) from R2 (dynamically selects wardrobe preset)
// Step 2: fal.ai LatentSync

POST https://queue.fal.run/fal-ai/latentsync
{
  "video_url": gestureVideoUrl,  // R2 public URL
  "audio_url": audioUrl,        // R2 public URL
  "options": {
    "loop_video": true,
    "loop_mode": tier === 'pro' || tier === 'ultra' ? 'alternate' : 'simple'
  }
}
```

### Agent: Editing Agent

```typescript
// Creatomate for all tiers
// Submagic for Pro + Ultra
// Stitches the fixed outro from Creator DNA (no regeneration)

POST https://api.creatomate.com/v1/renders
{
  "template_id": getTemplateId(tier, niche, language),
  "modifications": {
    "MainVideo.source": lipSyncVideoUrl,
    "IntroVideo.source": introVideoUrl,         // ultra only
    "OutroVideo.source": creator.outro_video_url, // fixed outro, no regeneration
    "Logo.source": creator.logo_url || null,
    "ChannelName.text": creator.name,
    "BackgroundMusic.volume": 0.15,
    "CaptionStyle": language === 'hi-IN' ? 'hindi_animated' : 'english_animated'
  }
}

// Submagic API call (Pro + Ultra only):
POST https://api.submagic.co/v1/enhance
{
  "video_url": creatomateOutputUrl,
  "features": {
    "broll": true,
    "auto_zoom": true,
    "music": true,
    "silence_removal": true
  }
}
```

### Agent: QA Agent

```typescript
// Automatically verifies the final video assembly before completing the job.
// Input: final enhanced video URL
// Output: Approved video URL (or throws error, setting job to 'failed' on specific QA checks)
// Checks performed:
// - Verifies lip-sync and audio track length are aligned
// - Verifies the presence of the fixed outro video segment at the end
// - Analyzes frame content to check logo visibility and watermark guidelines
// - Flags subtitle overlap issues
```

---

## 8. Cloudflare Queues — Background Processing

### Why Queues Are Mandatory for V2

Video generation takes 3-10 minutes end-to-end. Cloudflare Workers have a 100-second HTTP timeout. Without Queues, every video generation will fail or require the user to keep the tab open.

### Queue Setup

```bash
# Create the video queue
wrangler queues create personalityos-video-queue

# Deploy the Queue Consumer Worker
cd workers/video-consumer
wrangler deploy
```

### Two Workers in V2

```
Worker 1: personalityos-api (existing)
  - All HTTP routes
  - Validates video job request
  - Creates job in Supabase (status: pending)
  - Pushes job to Queue
  - Returns job_id immediately (< 1 second)
  - Serves status polling endpoint

Worker 2: personalityos-video-consumer (new)
  - No HTTP routes
  - Listens to personalityos-video-queue
  - Runs all agents in sequence
  - Updates Supabase at each step
  - Has 15-minute CPU time limit (no timeout pressure)
  - Saves all outputs to R2
```

### Job Flow

```
Frontend: POST /api/videos/create-job
        ↓
API Worker: 
  1. Validate request + tier check
  2. Check monthly video count (enforce tier limits)
  3. Create video_jobs row (status: pending)
  4. Push to Queue: { job_id, creator_id, user_id, tier, topic, ... }
  5. Return: { job_id, status: 'pending' }
        ↓
Frontend: starts polling GET /api/videos/:id/status every 5 seconds
User can close tab — job continues
        ↓
Video Consumer Worker picks up job:
  1. Style Learning Agent → update status: 'style_learning'
  2. Research Agent → update status: 'researching'
  3. Script Agent → update status: 'scripting'
  4. Return script to Supabase → update status: 'awaiting_approval'
        ↓
Frontend: polling sees 'awaiting_approval'
  → Shows script approval screen to user
  → User edits (optional) and approves
        ↓
Frontend: POST /api/videos/:id/approve-script
API Worker: updates video_jobs.approved_script, status: 'approved'
Pushes CONTINUATION job to Queue (separate queue message)
        ↓
Video Consumer picks up continuation:
  5. TTS Agent → update status: 'generating_tts'
  6. Intro Agent (Ultra) → update status: 'generating_intro'
  7. Video Agent → update status: 'assembling_video'
  8. Editing Agent → update status: 'editing_video'
  9. QA Agent → update status: 'qa_validation'
  10. Complete → update status: 'completed', final_video_url set
        ↓
Frontend: polling sees 'completed'
  → Shows download button
  → Sends notification (dashboard banner)
```

### Retry Logic

Queue Consumer retries failed jobs up to 3 times automatically. On permanent failure after 3 retries, status is set to 'failed' with the specific step and error message. User sees "Retry" button on the specific failed step.

---

## 9. Database Changes

### New Tables

```sql
-- Video jobs table
CREATE TABLE IF NOT EXISTS video_jobs (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  creator_id          TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id             UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier                TEXT NOT NULL,  -- 'standard' | 'pro' | 'ultra'
  topic               TEXT NOT NULL,
  niche               TEXT NOT NULL,
  language            TEXT NOT NULL DEFAULT 'hi-IN',
  research_brief      TEXT,           -- JSON
  generated_script    TEXT,           -- raw script from agent
  approved_script     TEXT,           -- user-edited + approved
  hook_line           TEXT,           -- ultra only
  status              TEXT NOT NULL DEFAULT 'pending',
  current_step        TEXT,
  error_message       TEXT,
  audio_url           TEXT,           -- R2 path
  hook_audio_url      TEXT,           -- ultra only, R2 path
  intro_video_url     TEXT,           -- ultra only, R2 path
  lipsync_video_url   TEXT,           -- R2 path
  final_video_url     TEXT,           -- R2 path (download URL)
  duration_seconds    INTEGER,
  word_count          INTEGER,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  approved_at         TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ
);

CREATE INDEX idx_video_jobs_user ON video_jobs(user_id);
CREATE INDEX idx_video_jobs_creator ON video_jobs(creator_id);
CREATE INDEX idx_video_jobs_status ON video_jobs(status);

ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own video jobs"
  ON video_jobs FOR ALL
  USING (auth.uid() = user_id);

-- Creator DNA Table (permanent profile settings)
CREATE TABLE IF NOT EXISTS creator_dna (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  creator_id            TEXT NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  face_identity         TEXT,         -- reference image/vector URL
  gemini_character_id   TEXT,         -- from gemini-omni-character API
  voice_profile         TEXT,         -- Sarvam voice key
  speaking_pace         DOUBLE PRECISION DEFAULT 1.0,
  teaching_style        TEXT,         -- style prompt preset
  brand_colours         TEXT[],       -- hex codes
  camera_framing        TEXT,         -- e.g. medium, close-up
  gesture_style         TEXT,         -- e.g. subtle, energetic
  subtitle_style        TEXT,         -- JSON styling properties
  editing_template      TEXT,         -- Creatomate template ID
  wardrobe_presets      TEXT[],       -- array of clothing R2 paths
  background_presets    TEXT[],       -- array of background R2 paths
  logo_url              TEXT,         -- R2 branding asset path
  intro_settings        TEXT,         -- JSON
  outro_video_url       TEXT,         -- Fixed outro R2 path (stitched, no regeneration)
  gesture_video_a_url   TEXT,         -- R2 path
  gesture_video_b_url   TEXT,         -- pro/ultra only, R2 path
  avatar_ready          BOOLEAN DEFAULT false,
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE creator_dna ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own creator DNA"
  ON creator_dna FOR ALL
  USING (auth.uid() = user_id);
```

### Modified Tables

```sql
-- Add video-related columns to characters linking to Creator DNA
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS creator_dna_id TEXT REFERENCES creator_dna(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS gemini_character_id TEXT,
ADD COLUMN IF NOT EXISTS avatar_ready BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS videos_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS videos_reset_at TIMESTAMPTZ DEFAULT NOW();
```

### R2 Path Structure for Videos

```
avatars/{userId}/{creatorId}/gesture_a_outfit1.mp4
avatars/{userId}/{creatorId}/gesture_b_outfit1.mp4  (pro/ultra)

videos/{userId}/{creatorId}/{jobId}/audio.mp3
videos/{userId}/{creatorId}/{jobId}/hook_audio.mp3  (ultra)
videos/{userId}/{creatorId}/{jobId}/intro.mp4       (ultra)
videos/{userId}/{creatorId}/{jobId}/lipsync.mp4
videos/{userId}/{creatorId}/{jobId}/final.mp4
```

---

## 10. Backend Routes — Complete Map

### Existing Routes (Unchanged)

All V1 and V1.5 routes remain unchanged.

### New Video Routes

```
POST /api/videos/create-job
  Auth: Required
  Body: { creator_id, topic, niche, language }
  Action: Validates tier, creates video_job, pushes to Queue
  Returns: { job_id, status: 'pending' }

GET  /api/videos/:id/status
  Auth: Required
  Returns: { status, current_step, generated_script?, final_video_url? }

POST /api/videos/:id/approve-script
  Auth: Required
  Body: { approved_script: string }
  Action: Saves approved script, pushes continuation to Queue
  Returns: { status: 'approved' }

GET  /api/videos
  Auth: Required
  Query: ?creator_id=&limit=20&page=1
  Returns: { data: VideoJob[] }

DELETE /api/videos/:id
  Auth: Required
  Action: Deletes video_job + all R2 files for this job
  Returns: { deleted: true }
```

### New Creator DNA / Onboarding Routes

```
POST /api/creators/onboard-photos
  Auth: Required
  Body: { creator_id, photos: File[], details }
  Action: Option A onboarding. Generates Creator DNA from uploaded photos
  Returns: { job_id, status: 'pending' }

POST /api/creators/onboard-video
  Auth: Required
  Body: FormData with video file, creator_id
  Action: Option B onboarding. Triggers Style Learning Agent to extract style from video and populate Creator DNA
  Returns: { job_id, status: 'pending' }

GET  /api/creators/:id/dna-status
  Auth: Required
  Returns: { avatar_ready, dna: CreatorDNA }
```

### New Subscription Routes

```
GET  /api/subscription/status
  Auth: Required
  Returns: { tier, videos_used, videos_limit, reset_at }

POST /api/subscription/upgrade
  Auth: Required
  Body: { tier: 'standard' | 'pro' | 'ultra' }
  (Razorpay integration — V2 week 1)
```

---

## 11. Provider Adapter Changes

### New Methods in interface.ts

```typescript
interface GenerationProvider {
  // Existing methods unchanged...
  
  // New V2 methods:
  generateAvatarVideo(
    referenceImageUrl: string,
    prompt: string,
    duration: number
  ): Promise<GenerationResult>
  
  generateContextualIntro(
    creatorId: string,
    prompt: string,
    hookAudioUrl: string,
    duration: number
  ): Promise<GenerationResult>
  
  createGeminiCreator(
    referenceImageUrl: string,
    creatorDescription: string
  ): Promise<{ creator_id: string }>
}
```

### New Files

```
workers/api/src/providers/video/
  muapi-video.ts        ← Gemini Omni + avatar generation
  fal-lipsync.ts        ← fal.ai LatentSync
  creatomate.ts         ← Post-production assembly
  submagic.ts           ← B-roll + zoom + music (Pro/Ultra)

workers/api/src/services/
  research-agent.ts     ← Gemini 2.5 Flash + web search
  script-agent.ts       ← Claude Sonnet script generation
  tts-agent.ts          ← Sarvam AI TTS
  video-assembler.ts    ← Orchestrates all video agents

workers/video-consumer/
  src/index.ts          ← Queue Consumer Worker
  wrangler.toml         ← Consumer Worker config
```

---

## 12. Frontend — New Pages

### `/dashboard/create-video` — Video Job Creation

```
Step 1: Choose creator profile (if multiple)
Step 2: Enter topic
  - Topic text input
  - Niche confirmation (pre-filled from creator profile)
  - Language selection (Hindi / English)
  - Duration hint (Standard: 1 min, Pro: 2 min, Ultra: 3 min)
  → "Research & Write Script →" button
  → Job created, status polling begins

Step 3: Script Approval (same page, after status = 'awaiting_approval')
  - Full script displayed in readable format
  - Editable text area (user can modify)
  - Word count indicator (Standard: ~130w, Pro: ~260w, Ultra: ~390w)
  - Estimated video length (1 min / 2 min / 3 min)
  - Outro notice: "A fixed outro will be automatically appended to the end of the video."
  - "Approve & Generate Video →" button
  - "Request new script" (regenerates)
```

### `/dashboard/videos` — Video Library

```
Grid of completed videos
  - Thumbnail (first frame of final video)
  - Topic title
  - Duration
  - Date generated
  - Status badge (processing / ready / failed)
  - Download button
  - Delete button

In-progress jobs shown at top with progress indicator:
  "Adapting style..." → "Researching topic..." → "Writing script..." →
  "Awaiting your approval" → "Generating audio..." →
  "Creating video..." → "Adding finishing touches..." → "Performing QA check..."
```

### `/dashboard/creator-setup` — Creator Setup & DNA Status

Allows users to configure their permanent profile using Option A or Option B.

```
Onboarding Selection:
  Option A: Photo-based Setup
    - Upload 3-5 high-quality face photos
    - Set voice, colors, and background preferences manually
    → System queues photo-to-avatar generation (saves to Creator DNA)
  
  Option B: Video-based Setup
    - Upload an existing 15-60s explainer video file
    → Style Learning Agent extracts framing, gestures, pacing, wardrobe, and style parameters
    → Automatically populates Creator DNA profile (user can review and edit extracted values)

Status Panel (while processing):
  "Setting up your explainer creator profile"
  
  [✓] Reference files received
  [⏳] Running Style Learning Agent... (spinning)
  [ ] Generating reference gesture video A...
  [ ] Generating reference gesture video B (Pro/Ultra)...
  
  "This takes 2-3 minutes. You can close this tab."
  
  On completion:
  [▶] Preview gesture video A (Default outfit)
  [▶] Preview gesture video B (Alternative outfit)
  "Your Creator profile is ready. Create your first video →"
```

---

## 13. Creatomate Templates

### Template Strategy

Three base templates built once in Creatomate's web editor:

**Template 1: Education (Hindi/English)**
- Dark academic background with subtle texture
- Animated word-by-word captions (white text, yellow highlights)
- Logo top-right corner
- Channel name bottom-left
- Subtle background music (instrumental)
- Outro card: "Follow for daily [niche] content"

**Template 2: Tech/News (English)**
- Clean minimal dark background
- Fast-cut caption style (Hormozi-inspired)
- News ticker element at bottom
- Logo top-left
- Tech ambient background music
- Outro: Subscribe CTA

**Template 3: Health/Wellness (Hindi/English)**
- Light, energetic background (soft gradient)
- Clean rounded caption boxes
- Wellness color palette
- Logo centered bottom
- Uplifting background music

### Template Selection Logic

```typescript
function selectTemplate(niche: string, language: string): string {
  if (niche.includes('upsc') || niche.includes('education') || 
      niche.includes('coaching')) {
    return TEMPLATE_IDS.education
  }
  if (niche.includes('ai') || niche.includes('tech') || 
      niche.includes('startup')) {
    return TEMPLATE_IDS.tech_news
  }
  if (niche.includes('health') || niche.includes('fitness') || 
      niche.includes('wellness')) {
    return TEMPLATE_IDS.health_wellness
  }
  return TEMPLATE_IDS.education  // default
}
```

### Template Variables (Creatomate modifications per render)

```typescript
{
  "MainVideo.source": lipSyncVideoUrl,
  "IntroVideo.source": introVideoUrl || null,
  "Logo.source": creator.logo_url || DEFAULT_LOGO,
  "ChannelName.text": creator.name,
  "NicheTag.text": niche,
  "CaptionLanguage": language,
  "BackgroundMusic.volume": 0.12,
  "OutroText.text": `Follow @${creator.name} for daily ${niche} content`
}
```

---

## 14. Tool Stack — Final Decisions

| Layer | Tool | Tier | Decision |
|---|---|---|---|
| Creator profile | MuAPI Gemini Omni Character | All | ✅ One-time per creator |
| Gesture videos | MuAPI Gemini Omni Image-to-Video | All | ✅ One-time per creator |
| Research | Gemini 2.5 Flash + search | All | ✅ Free 1500 req/day |
| Script | Claude Sonnet | All | ✅ Existing integration |
| TTS | Sarvam AI Bulbul V3 | All | ✅ Hindi + English (Indian accent) |
| Lip sync | fal.ai LatentSync | All | ✅ FINAL_VERDICT confirmed |
| Assembly | Creatomate | All | ✅ Templates, no length limit |
| B-roll + zoom | Submagic API | Pro + Ultra | ✅ Higher tier only |
| Contextual intro | MuAPI Gemini Omni | Ultra | ✅ Ultra differentiator |
| Async jobs | Cloudflare Queues | All | ✅ Mandatory for video |
| Payments | Razorpay | All | ✅ Week 1 of V2 |

### Explicitly Rejected

| Tool | Reason |
|---|---|
| Hedra | Subscription cost + 720p ceiling. Gemini Omni on MuAPI covers same use case. |
| ElevenLabs | Sarvam AI is sufficient for all three users. Single TTS API is simpler. |
| KittenTTS | No Hindi, no voice cloning. Not suitable yet. |
| LongCat-Video | Still requires 2×A100 GPU. Not on any hosted API. |
| Creatomate alone without Submagic | B-roll is a real differentiator for Pro tier. Keep both. |

---

## 15. Cost Model Per Tier

### Standard — ₹999/month (30 videos × 1 min)

| Step | Tool | Cost per video |
|---|---|---|
| Research + Script | Claude Haiku | ₹2 |
| TTS (1 min audio) | Sarvam AI | ₹2 |
| Lip sync (1 min) | fal.ai LatentSync | ₹6 |
| Assembly | Creatomate | ₹5 |
| **Total per video** | | **₹15** |
| **30 videos/month** | | **₹450** |
| **Margin** | | **₹549** |

### Pro — ₹2499/month (30 videos × 2 min)

| Step | Tool | Cost per video |
|---|---|---|
| Research + Script | Claude Sonnet | ₹8 |
| TTS (2 min audio) | Sarvam AI | ₹4 |
| Lip sync (2 min) | fal.ai LatentSync | ₹12 |
| Assembly | Creatomate | ₹5 |
| Post-production | Submagic API | ₹35 |
| **Total per video** | | **₹64** |
| **30 videos/month** | | **₹1,920** |
| **Margin** | | **₹579** |

### Ultra — ₹4999/month (30 videos × 3 min)

| Step | Tool | Cost per video |
|---|---|---|
| Research + Script | Claude Sonnet | ₹8 |
| TTS + Hook audio | Sarvam AI | ₹8 |
| Contextual intro (5s) | Gemini Omni (₹125/min rate) | ₹10 |
| Lip sync (3 min) | fal.ai LatentSync | ₹18 |
| Assembly | Creatomate | ₹5 |
| Post-production | Submagic | ₹35 |
| **Total per video** | | **₹84** |
| **30 videos/month** | | **₹2,520** |
| **Margin** | | **₹2,479** |

**Ultra is highly profitable at 30 videos.**
- **Margin**: ₹2,479 (profit) per user per month.
- No pricing adjustments or caps are required since the cost model is healthy.

---

## 16. Build Order — Day by Day

### Week 1 — Foundation

```
Day 1: Database migrations (video_jobs, creator_dna tables)
Day 2: Cloudflare Queue setup + Video Consumer Worker skeleton
Day 3: Razorpay integration (subscription tiers)
Day 4: Sarvam AI TTS adapter + test
Day 5: fal.ai LatentSync adapter + test
```

### Week 2 — Agent Pipeline

```
Day 6:  Style Learning Agent & Research Agent (Gemini 2.5 Flash + search)
Day 7:  Script Agent (Claude Sonnet + Creator DNA)
Day 8:  Wire Style → Research → Script → Queue → status polling
Day 9:  Script approval UI (/dashboard/create-video Step 3)
Day 10: Video Agent (loop + LatentSync)
```

### Week 3 — Post-Production + Creator Setup

```
Day 11: Creatomate templates (design all 3 templates)
Day 12: Creatomate API integration + fixed outro support
Day 13: Gemini Omni Creator + gesture video generation (Option A)
Day 14: Style Learning Agent onboarding video extraction (Option B)
Day 15: Creator setup flow UI (/dashboard/creator-setup)
```

### Week 4 — Pro + Ultra + QA + Polish

```
Day 16: Submagic API integration (Pro tier)
Day 17: Ultra tier — hook line generation + Gemini Omni intro
Day 18: Ultra tier — Creatomate stitching (intro + main + fixed outro)
Day 19: QA Agent validation layer implementation
Day 20: Video library page (/dashboard/videos)
Day 21: End-to-end test all three tiers
Day 22: Staging deployment + user testing
Day 23: Production deployment
Day 24: First 3 users onboarded (concierge sprint)
```

---

## 17. Risk Register

| Risk | Severity | Likelihood | Mitigation |
|---|---|---|---|
| fal.ai LatentSync quality on looped video | High | Medium | Test with real gesture videos on Day 10. If quality poor, extend gesture video to 30s to reduce loop frequency. |
| Gemini Omni intro (Ultra) quality varies | Medium | Medium | Auto-generate 3 variations, show user best one. If all poor, skip intro and refund credit. |
| Sarvam AI Hindi quality for UPSC content | Medium | Low | Test with real UPSC teacher before launch. Bulbul V3 handles Hinglish natively. |
| Cloudflare Queue Consumer 15-min limit | High | Low | 3-minute video pipeline should complete in 5-8 min. If not, split into two queue messages. |
| Creatomate auto-caption accuracy in Hindi | Medium | Medium | Test thoroughly. Creatomate uses OpenAI Whisper which has good Hindi support. Fallback: send Sarvam STT transcript as SRT file. |
| Pro margin too thin at 30 videos | Medium | Medium | Monitor API utilization. If needed, reduce to 25 videos/month or increase price to ₹2999. |
| Ultra tier margin variations | Low | Low | Monitor actual intro API costs. Scaled cost is highly profitable. |
| MuAPI Gemini Omni availability | Medium | Low | MuAPI is exclusive Gemini Omni API provider. If downtime, queue jobs and retry. |

---

## 18. Success Criteria

### V2 is complete when:

**Technical:**
- A UPSC teacher completes the full flow — topic to download — in under 20 minutes
- User can close the browser after script approval and video completes in background
- All three tiers generate distinctly different quality output
- Creatomate templates render correctly for Hindi and English content
- Gesture videos loop invisibly (no visible jump at loop point)

**Business:**
- 3 paying users on any tier within 2 weeks of launch
- At least one user generates a video daily for 7 consecutive days
- Zero refund requests in first month

### First User Validation Questions (ask after first video)

1. Did the voice sound natural for the topic?
2. Did the captions match what was said?
3. Would you post this video as-is or does it need changes?
4. What would you change about the script?
5. How long did the whole process take?

---

## 19. Opening Prompt for V2 Build Sessions

```
You are the Backend/Frontend/Agent Developer for PersonalityOS V2 (AI Explainer Studio for Knowledge Creators).

V2 Goal: Automated video pipeline for explaining creators.
  Creator DNA → Style Learning Agent → Research → Script → User approves → 
  TTS → Video Assembly (LatentSync) → Editing (Creatomate + Submagic) → QA Agent → Download

Stack:
  Frontend: Next.js 16 + TypeScript + Tailwind → Cloudflare Pages
  Backend: Cloudflare Workers + Hono → personalityos-api
  Queue Consumer: workers/video-consumer/ (new)
  Database: Supabase PostgreSQL
  Storage: Cloudflare R2
  Queue: Cloudflare Queues (personalityos-video-queue)

V2 Tool Stack:
  Creator DNA profiles: MuAPI Gemini Omni Character
  Onboarding styles: Option A (Photo-based setup) & Option B (Style Learning video analysis)
  Research: Gemini 2.5 Flash + web search
  Script: Claude Sonnet (fixed outro appended in post-production)
  TTS: Sarvam AI Bulbul V3 (Hindi + English both)
  Lip sync: fal.ai LatentSync
  Assembly & Outro: Creatomate (templates + fixed outro card)
  B-roll/zoom: Submagic API (Pro + Ultra only)
  Contextual intro: MuAPI Gemini Omni (Ultra only)
  Payments: Razorpay

Three tiers:
  Standard (₹999): 30×1min, 1 outfit, basic template
  Pro (₹2499): 30×2min, 5 outfits, Submagic B-roll
  Ultra (₹4999): 30×3min, unlimited outfits, contextual intro, full production

V1.5 is live at: personalityos-d1x.pages.dev
All reseller features removed from V2. All other V1.5 features unchanged.

Read PERSONALITYOS_V2_ARCHITECTURE.md before starting any work.
Today's task: [DESCRIBE YOUR TASK]
Working on branch: [BRANCH NAME]
```

---

*Document version: 2.0.0*  
*Status: Architecture finalized — Ready for implementation*  
*Date: July 2026*  
*Build start: Confirm pricing model before Day 1*
