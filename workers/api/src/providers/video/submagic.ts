import type { Env } from '../../index';

export interface SubmagicEnhanceInput {
  videoUrl: string;
  broll?: boolean;
  autoZoom?: boolean;
  music?: boolean;
  silenceRemoval?: boolean;
  jobId: string;
}

export interface SubmagicEnhanceResult {
  enhancedVideoUrl: string;
  submagicId: string;
  isMock: boolean;
}

/**
 * Submagic API Provider (Pro & Ultra Tiers)
 * Enhances videos with automated B-roll, dynamic auto-zoom, background music, and silence removal.
 */
export async function enhanceVideoWithSubmagic(
  env: Env,
  input: SubmagicEnhanceInput
): Promise<SubmagicEnhanceResult> {
  const apiKey = env.SUBMAGIC_API_KEY;
  const jobId = input.jobId;

  if (!apiKey) {
    console.warn('[Submagic Provider] SUBMAGIC_API_KEY missing. Returning input video URL as fallback.');
    return {
      enhancedVideoUrl: input.videoUrl,
      submagicId: `mock_submagic_${jobId}`,
      isMock: true,
    };
  }

  console.log(`[Submagic Provider] Enhancing video for job ${jobId}...`);

  const response = await fetch('https://api.submagic.co/v1/enhance', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_url: input.videoUrl,
      features: {
        broll: input.broll ?? true,
        auto_zoom: input.autoZoom ?? true,
        music: input.music ?? true,
        silence_removal: input.silenceRemoval ?? true,
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Submagic API failed (${response.status}): ${errorText}`);
  }

  const data = (await response.json()) as any;
  const enhancedVideoUrl = data.video_url || data.output_url;

  if (!enhancedVideoUrl) {
    throw new Error('Submagic response did not contain enhanced video URL');
  }

  return {
    enhancedVideoUrl,
    submagicId: data.id || `submagic_${jobId}`,
    isMock: false,
  };
}
