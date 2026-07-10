-- Migration: V2 Video Pipeline and Creator DNA Setup
-- Date: July 2026

-- 1. Create creator_dna Table
CREATE TABLE IF NOT EXISTS creator_dna (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  creator_id            TEXT NOT NULL, -- linked to characters(id)
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

-- Enable Row Level Security (RLS) for creator_dna
ALTER TABLE creator_dna ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy for creator_dna
CREATE POLICY "Users manage own creator DNA"
  ON creator_dna FOR ALL
  USING (auth.uid() = user_id);

-- 2. Create video_jobs Table
CREATE TABLE IF NOT EXISTS video_jobs (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
  creator_id          TEXT NOT NULL,
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

-- Create indices for video_jobs
CREATE INDEX IF NOT EXISTS idx_video_jobs_user ON video_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_creator ON video_jobs(creator_id);
CREATE INDEX IF NOT EXISTS idx_video_jobs_status ON video_jobs(status);

-- Enable Row Level Security (RLS) for video_jobs
ALTER TABLE video_jobs ENABLE ROW LEVEL SECURITY;

-- Create RLS Policy for video_jobs
CREATE POLICY "Users manage own video jobs"
  ON video_jobs FOR ALL
  USING (auth.uid() = user_id);

-- 3. Modify characters Table
-- Add video-related columns and foreign keys linking to creator_dna
ALTER TABLE characters
ADD COLUMN IF NOT EXISTS creator_dna_id TEXT REFERENCES creator_dna(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS gemini_character_id TEXT,
ADD COLUMN IF NOT EXISTS avatar_ready BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS videos_used_this_month INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS videos_reset_at TIMESTAMPTZ DEFAULT NOW();

-- Add foreign key constraint to creator_dna pointing to characters table
ALTER TABLE creator_dna
ADD CONSTRAINT fk_creator_dna_characters
FOREIGN KEY (creator_id) REFERENCES characters(id) ON DELETE CASCADE;
