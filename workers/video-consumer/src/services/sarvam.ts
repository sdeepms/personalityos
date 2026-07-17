import type { Env } from '../index';

export interface TTSSpeechOptions {
  text: string;
  language?: string; // 'hi-IN' | 'en-IN' | etc.
  speaker?: string;  // e.g. 'meera', 'arvind', 'shivam', 'pavithra'
  gender?: 'male' | 'female';
  pace?: number;     // e.g. 0.95
  loudness?: number; // e.g. 1.5
  jobId?: string;
}

export interface TTSResult {
  audioUrl: string;
  r2Key: string;
  isMock: boolean;
}

/**
 * Maps gender/language to default Sarvam Bulbul V3 speaker if none provided
 */
export function getDefaultSpeaker(gender: 'male' | 'female' = 'female', language: string = 'hi-IN'): string {
  if (gender === 'male') {
    return 'arvind';
  }
  return 'meera';
}

/**
 * Formats language code to Sarvam supported ISO format
 */
export function normalizeLanguageCode(lang?: string): string {
  if (!lang) return 'hi-IN';
  const l = lang.toLowerCase().trim();
  if (l === 'hi' || l === 'hindi' || l === 'hi-in') return 'hi-IN';
  if (l === 'en' || l === 'english' || l === 'en-in') return 'en-IN';
  return 'hi-IN';
}

/**
 * Converts a Base64 string to a Uint8Array
 */
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Sarvam AI Bulbul V3 TTS Adapter
 * Generates speech audio from text and saves to R2 storage.
 */
export async function generateSpeech(env: Env, options: TTSSpeechOptions): Promise<TTSResult> {
  const apiKey = env.SARVAM_API_KEY;
  const targetLanguage = normalizeLanguageCode(options.language);
  const speaker = options.speaker || getDefaultSpeaker(options.gender, targetLanguage);
  const pace = options.pace ?? 0.95;
  const loudness = options.loudness ?? 1.5;
  const jobId = options.jobId || crypto.randomUUID().slice(0, 8);
  const r2Key = `audio/${jobId}_${Date.now()}.mp3`;

  // Fallback to mock generation if SARVAM_API_KEY is missing
  if (!apiKey) {
    console.warn('[Sarvam TTS Adapter] SARVAM_API_KEY missing. Returning mock audio output.');
    
    // Minimal mock MP3 header bytes for dev testing
    const mockBytes = new Uint8Array([
      0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
    ]);
    
    if (env.STORAGE) {
      await env.STORAGE.put(r2Key, mockBytes, {
        httpMetadata: { contentType: 'audio/mpeg' },
      });
    }

    return {
      audioUrl: `http://localhost:8787/files/${r2Key}`,
      r2Key,
      isMock: true,
    };

  }

  // Live Sarvam AI API call
  console.log(`[Sarvam TTS Adapter] Requesting TTS for job ${jobId} (Lang: ${targetLanguage}, Speaker: ${speaker})`);

  const response = await fetch('https://api.sarvam.ai/text-to-speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
    },
    body: JSON.stringify({
      inputs: [options.text],
      target_language_code: targetLanguage,
      speaker: speaker,
      model: 'bulbul:v3',
      pace: pace,
      loudness: loudness,
      enable_preprocessing: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[Sarvam TTS Adapter] API Error ${response.status}: ${errorText}`);
    throw new Error(`Sarvam TTS API failed with status ${response.status}: ${errorText}`);
  }

  const data = (await response.json()) as { audios?: string[] };

  if (!data.audios || data.audios.length === 0 || !data.audios[0]) {
    throw new Error('Sarvam TTS API returned invalid or empty audio array');
  }

  const audioBytes = base64ToUint8Array(data.audios[0]);

  // Save to Cloudflare R2
  if (env.STORAGE) {
    await env.STORAGE.put(r2Key, audioBytes, {
      httpMetadata: { contentType: 'audio/mpeg' },
    });
  } else {
    console.warn('[Sarvam TTS Adapter] Cloudflare R2 STORAGE binding unavailable');
  }

  const workerBase = env.WORKER_URL || 'http://localhost:8787';
  return {
    audioUrl: `${workerBase}/files/${r2Key}`,
    r2Key,
    isMock: false,
  };
}
