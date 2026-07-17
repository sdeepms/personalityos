import type { Env } from '../index';

export interface LatentSyncOptions {
  videoUrl: string;
  audioUrl: string;
  guidanceScale?: number;
  seed?: number;
  jobId?: string;
}

export interface LatentSyncResult {
  videoUrl: string;
  requestId: string;
  isMock: boolean;
}

interface FalQueueResponse {
  request_id: string;
  response_url?: string;
  status_url?: string;
}

interface FalStatusResponse {
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  logs?: Array<{ message: string }>;
  error?: string;
}

interface FalResultResponse {
  video?: {
    url: string;
    content_type?: string;
  };
  output_video?: {
    url: string;
  };
}

/**
 * Polls fal.ai queue status until completion or timeout (max 300 seconds)
 */
async function pollFalQueue(statusUrl: string, responseUrl: string, apiKey: string): Promise<string> {
  const maxAttempts = 60; // 60 attempts * 5 sec interval = 300 seconds max
  const pollInterval = 5000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    console.log(`[fal.ai LatentSync] Polling queue status (attempt ${attempt}/${maxAttempts})...`);
    
    await new Promise((resolve) => setTimeout(resolve, pollInterval));

    const statusRes = await fetch(statusUrl, {
      headers: {
        Authorization: `Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!statusRes.ok) {
      console.warn(`[fal.ai LatentSync] Status poll warning: ${statusRes.status}`);
      continue;
    }

    const statusData = (await statusRes.json()) as FalStatusResponse;

    if (statusData.status === 'COMPLETED') {
      console.log('[fal.ai LatentSync] Job completed successfully!');
      
      const resultRes = await fetch(responseUrl, {
        headers: {
          Authorization: `Key ${apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!resultRes.ok) {
        throw new Error(`fal.ai result fetch failed with status ${resultRes.status}`);
      }

      const resultData = (await resultRes.json()) as FalResultResponse;
      const finalVideoUrl = resultData.video?.url || resultData.output_video?.url;

      if (!finalVideoUrl) {
        throw new Error('fal.ai response did not contain video URL');
      }

      return finalVideoUrl;
    } else if (statusData.status === 'FAILED') {
      throw new Error(`fal.ai LatentSync execution failed: ${statusData.error || 'Unknown error'}`);
    }
  }

  throw new Error('fal.ai LatentSync timed out after 300 seconds');
}

/**
 * fal.ai LatentSync Adapter
 * Submits lip synchronization job to fal.ai and polls for completion.
 */
export async function generateLatentSync(env: Env, options: LatentSyncOptions): Promise<LatentSyncResult> {
  const apiKey = env.FAL_KEY;
  const jobId = options.jobId || crypto.randomUUID().slice(0, 8);

  // Dev mock fallback if FAL_KEY is missing
  if (!apiKey) {
    console.warn('[fal.ai LatentSync Adapter] FAL_KEY missing. Returning mock video URL.');
    return {
      videoUrl: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      requestId: `mock_req_${jobId}`,
      isMock: true,
    };

  }

  console.log(`[fal.ai LatentSync Adapter] Submitting LatentSync job for ${jobId}...`);

  // Submit job to fal.ai queue endpoint
  const response = await fetch('https://queue.fal.run/fal-ai/latentsync', {
    method: 'POST',
    headers: {
      Authorization: `Key ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      video_url: options.videoUrl,
      audio_url: options.audioUrl,
      guidance_scale: options.guidanceScale ?? 1.5,
      seed: options.seed,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[fal.ai LatentSync Adapter] Submission failed ${response.status}: ${errorText}`);
    throw new Error(`fal.ai submission failed (${response.status}): ${errorText}`);
  }

  const queueData = (await response.json()) as FalQueueResponse;
  const requestId = queueData.request_id;
  const statusUrl = queueData.status_url || `https://queue.fal.run/fal-ai/latentsync/requests/${requestId}/status`;
  const responseUrl = queueData.response_url || `https://queue.fal.run/fal-ai/latentsync/requests/${requestId}`;

  console.log(`[fal.ai LatentSync Adapter] Job queued with request ID: ${requestId}`);

  // Poll queue until completion
  const finalVideoUrl = await pollFalQueue(statusUrl, responseUrl, apiKey);

  return {
    videoUrl: finalVideoUrl,
    requestId,
    isMock: false,
  };
}
