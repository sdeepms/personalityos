import type { Env } from '../index';

export interface CreatomateRenderInput {
  lipSyncVideoUrl: string;
  introVideoUrl?: string;
  outroVideoUrl?: string;
  logoUrl?: string;
  channelName?: string;
  niche?: string;
  language?: string;
  tier?: 'standard' | 'pro' | 'ultra';
  jobId: string;
}

export interface CreatomateRenderResult {
  renderUrl: string;
  renderId: string;
  isMock: boolean;
}

export function getTemplateId(niche: string = 'Education', tier: string = 'standard'): string {
  const n = niche.toLowerCase();
  if (n.includes('tech') || n.includes('coding')) return 'tpl_tech_news_v1';
  if (n.includes('health') || n.includes('fitness')) return 'tpl_health_v1';
  return 'tpl_education_v1';
}

async function pollCreatomateRender(renderId: string, apiKey: string): Promise<string> {
  const maxAttempts = 60;
  const interval = 4000;

  for (let i = 1; i <= maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, interval));

    const response = await fetch(`https://api.creatomate.com/v1/renders/${renderId}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.warn(`[Creatomate] Render status poll error ${response.status}`);
      continue;
    }

    const data = (await response.json()) as any;
    if (data.status === 'succeeded' && data.url) {
      return data.url;
    } else if (data.status === 'failed') {
      throw new Error(`Creatomate render failed: ${data.error || 'Unknown error'}`);
    }
  }

  throw new Error('Creatomate render timed out after 240 seconds');
}

/**
 * Creatomate API Adapter
 * Renders final post-production video with template modifications.
 */
export async function renderCreatomate(
  env: Env,
  input: CreatomateRenderInput
): Promise<CreatomateRenderResult> {
  const apiKey = env.CREATOMATE_API_KEY;
  const templateId = getTemplateId(input.niche, input.tier);

  if (!apiKey) {
    console.warn('[Creatomate Adapter] CREATOMATE_API_KEY missing. Returning lip sync video URL as fallback.');
    return {
      renderUrl: input.lipSyncVideoUrl,
      renderId: `mock_render_${input.jobId}`,
      isMock: true,
    };
  }

  console.log(`[Creatomate Adapter] Submitting render for job ${input.jobId} (Template: ${templateId})...`);

  const modifications: Record<string, string | null> = {
    'MainVideo.source': input.lipSyncVideoUrl,
  };

  if (input.introVideoUrl) {
    modifications['IntroVideo.source'] = input.introVideoUrl;
  }
  if (input.outroVideoUrl) {
    modifications['OutroVideo.source'] = input.outroVideoUrl;
  }
  if (input.logoUrl) {
    modifications['Logo.source'] = input.logoUrl;
  }
  if (input.channelName) {
    modifications['ChannelName.text'] = input.channelName;
  }

  const response = await fetch('https://api.creatomate.com/v1/renders', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      template_id: templateId,
      modifications,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Creatomate API submission failed (${response.status}): ${errorText}`);
  }

  const renders = (await response.json()) as Array<{ id: string; url?: string; status: string }>;
  if (!renders || renders.length === 0) {
    throw new Error('Creatomate API returned empty render array');
  }

  const renderObj = renders[0];
  if (renderObj.status === 'succeeded' && renderObj.url) {
    return {
      renderUrl: renderObj.url,
      renderId: renderObj.id,
      isMock: false,
    };
  }

  const finalUrl = await pollCreatomateRender(renderObj.id, apiKey);
  return {
    renderUrl: finalUrl,
    renderId: renderObj.id,
    isMock: false,
  };
}
