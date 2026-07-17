import type { Env } from '../../index';

export interface GeminiOmniInput {
  prompt: string;
  referenceImageUrl?: string;
  aspectRatio?: '9:16' | '16:9' | '1:1';
  durationSeconds?: number;
}

export interface GeminiOmniResult {
  videoUrl: string;
  jobId: string;
  isMock: boolean;
}

/**
 * MuAPI Gemini Omni Creator Video Generation Provider
 * Generates initial gesture reference video or avatar scenes.
 */
export async function generateGeminiOmniVideo(
  env: Env,
  input: GeminiOmniInput
): Promise<GeminiOmniResult> {
  const apiKey = env.MUAPI_API_KEY;
  const jobId = crypto.randomUUID().slice(0, 8);

  if (!apiKey) {
    console.warn('[MuAPI Gemini Omni] MUAPI_API_KEY missing. Returning mock video result.');
    return {
      videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      jobId: `mock_omni_${jobId}`,
      isMock: true,
    };

  }

  console.log(`[MuAPI Gemini Omni] Requesting video generation for prompt: "${input.prompt.slice(0, 50)}..."`);

  const response = await fetch('https://api.muapi.ai/api/v1/gemini-omni', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      prompt: input.prompt,
      image_url: input.referenceImageUrl,
      aspect_ratio: input.aspectRatio || '9:16',
      duration: input.durationSeconds || 5,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`MuAPI Gemini Omni generation failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const videoUrl = data.video_url || data.output?.video_url;

  if (!videoUrl) {
    throw new Error('MuAPI response did not contain video_url');
  }

  return {
    videoUrl,
    jobId: data.id || jobId,
    isMock: false,
  };
}
