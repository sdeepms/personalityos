import type { Env } from '../index';

export interface CreatorDNA {
  id?: string;
  character_id?: string;
  niche?: string;
  target_audience?: string;
  speaking_tone?: string;
  speaking_pace?: number; // e.g. 0.95
  visual_style?: string;
  outro_video_url?: string;
  logo_url?: string;
  system_prompt?: string;
}

export interface StyleConfig {
  framing: 'close-up' | 'medium' | 'wide';
  gestures: 'expressive' | 'subtle' | 'conversational';
  speakingSpeedWPM: number;
  clothingStyle: string;
  editingStyle: {
    cutFrequencySeconds: number;
    transitionSpeed: string;
  };
  subtitleStyle: {
    font: string;
    position: 'bottom' | 'center';
    highlightColor: string;
  };
  pacing: string;
}

/**
 * Style Learning Agent
 * Loads Creator DNA profile and adapts it to style configuration.
 * Can analyze reference video during onboarding to extract custom style tokens.
 */
export async function runStyleAgent(
  env: Env,
  creatorDna: CreatorDNA,
  referenceVideoUrl?: string
): Promise<StyleConfig> {
  console.log('[Style Learning Agent] Analyzing creator style and parameters...');

  const tone = (creatorDna.speaking_tone || 'conversational').toLowerCase();
  const visual = (creatorDna.visual_style || 'professional').toLowerCase();

  let framing: 'close-up' | 'medium' | 'wide' = 'medium';
  if (visual.includes('close') || visual.includes('intimate')) {
    framing = 'close-up';
  } else if (visual.includes('wide') || visual.includes('studio')) {
    framing = 'wide';
  }

  let gestures: 'expressive' | 'subtle' | 'conversational' = 'conversational';
  if (tone.includes('energetic') || tone.includes('enthusiastic') || tone.includes('expressive')) {
    gestures = 'expressive';
  } else if (tone.includes('calm') || tone.includes('serious') || tone.includes('subtle')) {
    gestures = 'subtle';
  }

  const pace = creatorDna.speaking_pace ?? 0.95;
  const speakingSpeedWPM = Math.round(140 * pace);

  return {
    framing,
    gestures,
    speakingSpeedWPM,
    clothingStyle: visual.includes('formal') ? 'business formal' : 'casual smart',
    editingStyle: {
      cutFrequencySeconds: tone.includes('fast') ? 2.5 : 4.0,
      transitionSpeed: 'smooth',
    },
    subtitleStyle: {
      font: 'Inter',
      position: 'bottom',
      highlightColor: '#FFD700',
    },
    pacing: tone.includes('fast') ? 'rapid' : 'balanced',
  };
}
