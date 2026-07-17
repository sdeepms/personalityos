import type { Env } from '../index';
import type { ResearchBrief } from './research-agent';
import type { CreatorDNA } from './style-agent';

export interface ScriptAgentInput {
  researchBrief: ResearchBrief;
  creatorDna: CreatorDNA;
  tier?: 'standard' | 'pro' | 'ultra';
  language?: string;
}

export interface ScriptAgentResult {
  scriptText: string;
  wordCount: number;
  estimatedDurationSeconds: number;
  isMock: boolean;
}

export function getWordCountTarget(tier: 'standard' | 'pro' | 'ultra' = 'standard'): number {
  switch (tier) {
    case 'pro':
      return 260;
    case 'ultra':
      return 390;
    case 'standard':
    default:
      return 130;
  }
}

/**
 * Script Agent
 * Generates video script using Claude Sonnet with Creator DNA system prompt.
 * No dynamic outro generation (outro is fixed video clip).
 */
export async function runScriptAgent(
  env: Env,
  input: ScriptAgentInput
): Promise<ScriptAgentResult> {
  const tier = input.tier || 'standard';
  const targetWordCount = getWordCountTarget(tier);
  const language = input.language || input.researchBrief.language || 'hi-IN';
  const creator = input.creatorDna;
  const creatorName = creator.character_id || 'AI Creator';
  const systemPrompt = creator.system_prompt || 'You are an engaging Indian content creator producing high-impact educational short videos.';

  console.log(`[Script Agent] Generating ${targetWordCount}-word script for tier "${tier}" (${language})...`);

  const anthropicKey = env.ANTHROPIC_API_KEY || env.OPENROUTER_API_KEY;

  if (!anthropicKey) {
    console.warn('[Script Agent] Anthropic/OpenRouter API key missing. Returning mock script.');
    const mockScriptText = language === 'hi-IN'
      ? `क्या आप जानते हैं कि ${input.researchBrief.topic} आपकी जिंदगी को पूरी तरह बदल सकता है? ${input.researchBrief.main_fact} अधिकांश लोग समझते हैं कि यह बहुत मुश्किल है, लेकिन ${input.researchBrief.surprising_angle} हाल ही में ${input.researchBrief.example} अगर आंकड़ों की बात करें तो ${input.researchBrief.statistic} इसलिए आज ही ${input.researchBrief.takeaway} ध्यान रखें, निरंतरता ही सबसे बड़ी कुंजी है।`
      : `Did you know that ${input.researchBrief.topic} is revolutionizing how we learn and create? ${input.researchBrief.main_fact} Most people believe it takes years to master, but ${input.researchBrief.surprising_angle} Look at how ${input.researchBrief.example} Recent data shows that ${input.researchBrief.statistic} Here is your action item: ${input.researchBrief.takeaway} Consistency is key to long-term success.`;

    const wordCount = mockScriptText.split(/\s+/).length;
    return {
      scriptText: mockScriptText,
      wordCount,
      estimatedDurationSeconds: Math.round((wordCount / targetWordCount) * 60),
      isMock: true,
    };
  }

  const prompt = `Write a ${targetWordCount}-word video script on: "${input.researchBrief.topic}"

Research brief: ${JSON.stringify(input.researchBrief)}

Script format rules:
1. INTRO (15-20 seconds): Hook the viewer immediately. Start with the most surprising fact or question. Do not say "Hello", "Welcome back", or introduce yourself.
2. MAIN CONTENT: Cover the topic in your authentic voice using the research brief. Speak conversationally, directly to the viewer.
3. ${language === 'hi-IN' ? 'Write in natural Hindi / Hinglish. Technical terms can be written in English script or Devanagari.' : 'Write in clear English with relatable Indian context.'}
4. Return ONLY the script text to be spoken. No stage directions, no [PAUSE] or [SCENE] markers.
5. Do NOT write an outro or sign-off call-to-action (the outro is a fixed video clip appended automatically).
6. Target exactly ${targetWordCount} words.`;

  try {
    let scriptText = '';

    if (env.ANTHROPIC_API_KEY) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',


          max_tokens: 1024,
          system: `You are ${creatorName}. ${systemPrompt}`,
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`Anthropic API status ${response.status}: ${await response.text()}`);
      }

      const data = (await response.json()) as any;
      scriptText = data.content?.[0]?.text || '';
    } else {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [
            { role: 'system', content: `You are ${creatorName}. ${systemPrompt}` },
            { role: 'user', content: prompt },
          ],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API status ${response.status}`);
      }

      const data = (await response.json()) as any;
      scriptText = data.choices?.[0]?.message?.content || '';
    }

    const cleanScript = scriptText.trim();
    const wordCount = cleanScript.split(/\s+/).length;

    return {
      scriptText: cleanScript,
      wordCount,
      estimatedDurationSeconds: Math.round((wordCount / 140) * 60),
      isMock: false,
    };
  } catch (err) {
    console.error('[Script Agent] Error running Claude script generator:', err);
    const fallbackScript = `Here is your breakdown for ${input.researchBrief.topic}. ${input.researchBrief.main_fact} ${input.researchBrief.surprising_angle} ${input.researchBrief.takeaway}`;
    return {
      scriptText: fallbackScript,
      wordCount: fallbackScript.split(/\s+/).length,
      estimatedDurationSeconds: 60,
      isMock: true,
    };
  }
}
