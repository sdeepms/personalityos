import type { Env } from '../index';
import { generateSpeech } from '../services/sarvam';

export interface IntroAgentInput {
  topic: string;
  niche: string;
  hookLine?: string;
  language?: string;
  jobId: string;
}

export interface IntroAgentResult {
  introVideoUrl: string;
  hookAudioUrl?: string;
  isMock: boolean;
}

/**
 * Contextual Intro Agent (Ultra Tier Only)
 * Generates a 5-second cinematic hook intro video with voiceover audio.
 */
export async function runIntroAgent(
  env: Env,
  input: IntroAgentInput
): Promise<IntroAgentResult> {
  console.log(`[Contextual Intro Agent] Generating 5s Ultra intro for job ${input.jobId}...`);

  const hookText = input.hookLine || `Wait! What if I told you ${input.topic} is changing everything?`;
  
  // 1. Generate hook audio via Sarvam AI
  const ttsResult = await generateSpeech(env, {
    text: hookText,
    language: input.language || 'hi-IN',
    jobId: `${input.jobId}_intro`,
  });

  const mockIntroUrl = 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';


  return {
    introVideoUrl: mockIntroUrl,
    hookAudioUrl: ttsResult.audioUrl,
    isMock: true,
  };
}
