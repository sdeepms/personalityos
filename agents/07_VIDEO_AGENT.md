# Agent 07 — Video Agent

**Status:** STUB — Do not activate until V2

**Domain:** Video generation, video model adapters, video-specific prompt patterns
**Activate When:** V1 is live with real users and video generation is the next feature

---

## Activation Criteria

Before activating this agent:
- [ ] V1 is live
- [ ] At least 20 real users have used the image generation feature
- [ ] Users are asking for video generation
- [ ] V1 image consistency is validated (same face across 10 images)

---

## What This Agent Will Own (When Active)

- `generateVideo()` method added to the Provider Adapter interface
- Kling / Runway / Veo adapters
- Video-specific prompt patterns (motion descriptions, scene transitions)
- Video shortcuts added to Chat Studio (same interface, new capability)
- `video_url` column added to `generations` table
- Video thumbnails in Asset Library

---

## Key Principle

No new reference images needed for video. The Visual DNA stored in V1 (reference_image_urls) is sufficient to drive video generation with face consistency. This is a core product promise: set up the identity once, use it everywhere.

---

*Activate this agent when V1 is stable and video is the validated next step.*
