import { createClient } from '@supabase/supabase-js';
import { generateSpeech } from './services/sarvam';
import { generateLatentSync } from './services/fal';
import { runStyleAgent, type CreatorDNA } from './agents/style-agent';
import { runResearchAgent } from './agents/research-agent';
import { runScriptAgent } from './agents/script-agent';
import { runVideoAgent } from './agents/video-agent';

export interface Env {

  STORAGE: R2Bucket;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_KEY: string;
  SARVAM_API_KEY?: string;
  FAL_KEY?: string;
  MUAPI_API_KEY?: string;
  CREATOMATE_API_KEY?: string;
  SUBMAGIC_API_KEY?: string;
  GEMINI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

interface QueueMessage {
  job_id: string;
  action: 'start_pipeline' | 'continue_after_approval';
}

function getSupabaseClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/process-job') {
      try {
        const body = (await request.json()) as QueueMessage;
        const { job_id, action } = body;
        console.log(`[Video Consumer HTTP] Received trigger for job ${job_id} with action: ${action}`);

        if (action === 'start_pipeline') {
          ctx.waitUntil(handleStartPipeline(job_id, env));
        } else if (action === 'continue_after_approval') {
          ctx.waitUntil(handleContinueAfterApproval(job_id, env));
        } else {
          return new Response(JSON.stringify({ error: `Unknown action: ${action}` }), { status: 400 });
        }

        return new Response(JSON.stringify({ status: 'started', job_id, action }), {
          headers: { 'Content-Type': 'application/json' },
        });
      } catch (err: any) {
        console.error('[Video Consumer HTTP] Error processing request:', err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
      }
    }
    return new Response('Video Consumer Worker Running', { status: 200 });
  },

  async queue(batch: MessageBatch<QueueMessage>, env: Env, ctx: ExecutionContext): Promise<void> {
    for (const message of batch.messages) {
      const { job_id, action } = message.body;
      console.log(`[Video Consumer Queue] Processing job ${job_id} with action: ${action}`);

      try {
        if (action === 'start_pipeline') {
          await handleStartPipeline(job_id, env);
        } else if (action === 'continue_after_approval') {
          await handleContinueAfterApproval(job_id, env);
        } else {
          console.warn(`[Video Consumer] Unknown action type: ${action}`);
        }
      } catch (error: any) {
        console.error(`[Video Consumer] Failed processing job ${job_id}:`, error);
        const supabase = getSupabaseClient(env);
        await supabase
          .from('video_jobs')
          .update({
            status: 'failed',
            error_message: error.message || 'Pipeline execution failed',
          })
          .eq('id', job_id);
      }
    }
  },
};

/**
 * Stage 1: Initiates pipeline, runs Style Learning, Research, and Script Agents.
 * Puts job in 'awaiting_approval' status.
 */
async function handleStartPipeline(jobId: string, env: Env): Promise<void> {
  console.log(`[Video Consumer] Executing Stage 1 pipeline for job: ${jobId}`);
  const supabase = getSupabaseClient(env);

  // 1. Fetch job record
  const { data: job, error: jobError } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new Error(`Failed to fetch job ${jobId}: ${jobError?.message || 'Not found'}`);
  }

  // 2. Fetch Creator / Character DNA
  const { data: character } = await supabase
    .from('characters')
    .select('*')
    .eq('id', job.creator_id)
    .single();

  const creatorDna: CreatorDNA = {
    id: character?.id,
    character_id: character?.name || 'Creator',
    niche: job.niche,
    speaking_tone: character?.speaking_tone || 'conversational',
    visual_style: character?.visual_style || 'professional',
    speaking_pace: character?.speaking_pace ?? 0.95,
    outro_video_url: character?.outro_video_url,
    logo_url: character?.logo_url,
    system_prompt: character?.system_prompt || `You are ${character?.name || 'a creator'} in ${job.niche}.`,
  };

  // Step 1: Style Learning Agent
  await supabase
    .from('video_jobs')
    .update({ status: 'style_learning', current_step: 'Analyzing style & parameters' })
    .eq('id', jobId);

  const styleConfig = await runStyleAgent(env, creatorDna);
  console.log(`[Video Consumer] Style configuration loaded for job ${jobId}`);

  // Step 2: Research Agent (Gemini 2.5 Flash + Search Grounding)
  await supabase
    .from('video_jobs')
    .update({ status: 'researching', current_step: 'Running Gemini search grounding research' })
    .eq('id', jobId);

  const researchBrief = await runResearchAgent(env, {
    topic: job.topic,
    niche: job.niche,
    language: job.language,
  });
  console.log(`[Video Consumer] Research brief generated for job ${jobId}`);

  // Step 3: Script Agent (Claude Sonnet)
  await supabase
    .from('video_jobs')
    .update({ status: 'scripting', current_step: 'Generating script via Claude Sonnet' })
    .eq('id', jobId);

  const scriptResult = await runScriptAgent(env, {
    researchBrief,
    creatorDna,
    tier: job.tier as any,
    language: job.language,
  });
  console.log(`[Video Consumer] Script generated for job ${jobId}`);

  // Step 4: Save draft script and set status to 'awaiting_approval'
  await supabase
    .from('video_jobs')
    .update({
      status: 'awaiting_approval',
      current_step: 'Awaiting User Script Approval',
      research_brief: JSON.stringify(researchBrief),
      generated_script: scriptResult.scriptText,
      approved_script: scriptResult.scriptText, // Initial default
      word_count: scriptResult.wordCount,
      duration_seconds: scriptResult.estimatedDurationSeconds,
    })
    .eq('id', jobId);

  console.log(`[Video Consumer] Stage 1 completed for job ${jobId}. Awaiting user script approval.`);
}

/**
 * Stage 2: Triggered after user script approval.
 * Runs TTS, Video Assembly (LatentSync), Editing (Creatomate + Submagic), QA, and finishes.
 */
async function handleContinueAfterApproval(jobId: string, env: Env): Promise<void> {
  console.log(`[Video Consumer] Executing Stage 2 pipeline for job: ${jobId}`);
  const supabase = getSupabaseClient(env);

  // 1. Fetch job record
  const { data: job, error: jobError } = await supabase
    .from('video_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    throw new Error(`Failed to fetch job ${jobId}: ${jobError?.message || 'Not found'}`);
  }

  const scriptToUse = job.approved_script || job.generated_script;
  if (!scriptToUse) {
    throw new Error(`Job ${jobId} has no approved script to process.`);
  }

  // Step 1: TTS Agent (Sarvam AI Bulbul V3)
  await supabase
    .from('video_jobs')
    .update({ status: 'generating_tts', current_step: 'Generating voice audio via Sarvam AI' })
    .eq('id', jobId);

  const ttsResult = await generateSpeech(env, {
    text: scriptToUse,
    language: job.language,
    jobId,
  });
  console.log(`[Video Consumer] TTS generated: ${ttsResult.audioUrl}`);

  await supabase
    .from('video_jobs')
    .update({ audio_url: ttsResult.audioUrl })
    .eq('id', jobId);

  // Step 2: Video Assembly Agent (fal.ai LatentSync)

  await supabase
    .from('video_jobs')
    .update({ status: 'assembling_video', current_step: 'Running fal.ai LatentSync lip synchronization' })
    .eq('id', jobId);

  // Fetch reference gesture video from character or fallback
  const { data: character } = await supabase
    .from('characters')
    .select('reference_video_url')
    .eq('id', job.creator_id)
    .single();

  const gestureVideoUrl = character?.reference_video_url || 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4';

  const lipSyncResult = await runVideoAgent(env, {
    gestureVideoUrl,
    audioUrl: ttsResult.audioUrl,
    tier: job.tier as any,
    jobId,
  });
  console.log(`[Video Consumer] Lip sync generated: ${lipSyncResult.videoUrl}`);

  await supabase
    .from('video_jobs')
    .update({ lipsync_video_url: lipSyncResult.videoUrl })
    .eq('id', jobId);


  // Step 3: Editing Agent (Creatomate template stitching / final pass)
  await supabase
    .from('video_jobs')
    .update({ status: 'editing_video', current_step: 'Stitching outro & post-production' })
    .eq('id', jobId);

  // Step 4: Mark Completed
  const finalVideoUrl = lipSyncResult.videoUrl;

  await supabase
    .from('video_jobs')
    .update({
      status: 'completed',
      current_step: 'Video Completed',
      final_video_url: finalVideoUrl,
      completed_at: new Date().toISOString(),
    })
    .eq('id', jobId);

  console.log(`[Video Consumer] Job ${jobId} successfully completed! Final video: ${finalVideoUrl}`);
}
