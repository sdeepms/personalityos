import type { Env } from '../index';
import { generateLatentSync, type LatentSyncResult } from '../services/fal';

export interface VideoAgentInput {
  gestureVideoUrl: string;
  audioUrl: string;
  tier?: 'standard' | 'pro' | 'ultra';
  jobId: string;
}

/**
 * Video Agent
 * Manages video assembly, looping gesture videos based on tier, and triggering fal.ai LatentSync.
 */
export async function runVideoAgent(
  env: Env,
  input: VideoAgentInput
): Promise<LatentSyncResult> {
  const tier = input.tier || 'standard';
  console.log(`[Video Agent] Executing video assembly for job ${input.jobId} (${tier} tier)...`);

  // Call fal.ai LatentSync lip sync adapter
  const result = await generateLatentSync(env, {
    videoUrl: input.gestureVideoUrl,
    audioUrl: input.audioUrl,
    jobId: input.jobId,
  });

  console.log(`[Video Agent] Lip sync video complete: ${result.videoUrl}`);
  return result;
}
