import type { Env } from '../index';

export interface ResearchBriefInput {
  topic: string;
  niche: string;
  language?: string; // 'hi-IN' | 'en-IN'
}

export interface ResearchBrief {
  main_fact: string;
  surprising_angle: string;
  example: string;
  statistic: string;
  takeaway: string;
  topic: string;
  niche: string;
  language: string;
  isMock?: boolean;
}

/**
 * Research Agent
 * Uses Gemini 2.5 Flash with search grounding (or OpenRouter/mock fallback)
 * to produce structured research brief for video scripts.
 */
export async function runResearchAgent(
  env: Env,
  input: ResearchBriefInput
): Promise<ResearchBrief> {
  const language = input.language || 'hi-IN';
  const topic = input.topic.trim();
  const niche = input.niche.trim();

  console.log(`[Research Agent] Starting research for topic: "${topic}" in niche "${niche}" (${language})...`);

  const geminiApiKey = env.GEMINI_API_KEY || (env as any).OPENROUTER_API_KEY;

  if (!geminiApiKey) {
    console.warn('[Research Agent] API key missing. Returning mock research brief.');
    return {
      topic,
      niche,
      language,
      main_fact: `${topic} is becoming a key driver of innovation and change in the ${niche} industry.`,
      surprising_angle: `Most people assume ${topic} requires huge capital, but new digital models allow starting with zero upfront cost.`,
      example: `For example, a small creator in Tier-2 India leveraged ${topic} to reach over 100,000 monthly active users.`,
      statistic: `82% of Indian internet users prefer short-form video breakdowns when learning about ${topic}.`,
      takeaway: `Start by focusing on one core pillar of ${topic} today, test with your audience, and scale systematically.`,
      isMock: true,
    };
  }

  const prompt = `You are a world-class research assistant for a content creator.
Research this topic for a ${niche} content creator: "${topic}"

Find:
1. The most important fact or development (1-2 sentences)
2. A surprising angle or lesser-known insight
3. A relatable real-world example for Indian audience
4. One statistic or data point if available
5. A practical takeaway or action item for the viewer

Language context: Content will be in ${language === 'hi-IN' ? 'Hindi / Hinglish' : 'English'}.
Keep research concise, factual, and engaging.

CRITICAL: Return ONLY valid JSON matching this exact structure with no Markdown wrapping:
{
  "main_fact": "...",
  "surprising_angle": "...",
  "example": "...",
  "statistic": "...",
  "takeaway": "..."
}`;

  try {
    let responseText = '';

    if (env.GEMINI_API_KEY) {
      // Direct Gemini 2.5 Flash API with search grounding
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }],
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`Gemini API returned status ${response.status}`);
      }

      const data = (await response.json()) as any;
      responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      // OpenRouter fallback
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${(env as any).OPENROUTER_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [{ role: 'user', content: prompt }],
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenRouter API returned status ${response.status}`);
      }

      const data = (await response.json()) as any;
      responseText = data.choices?.[0]?.message?.content || '';
    }

    const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleanJson);

    return {
      topic,
      niche,
      language,
      main_fact: parsed.main_fact || `${topic} is essential for ${niche}.`,
      surprising_angle: parsed.surprising_angle || `Insight into ${topic}.`,
      example: parsed.example || `Real world example of ${topic}.`,
      statistic: parsed.statistic || `Stat about ${topic}.`,
      takeaway: parsed.takeaway || `Key takeaway for ${topic}.`,
      isMock: false,
    };
  } catch (err) {
    console.error('[Research Agent] Error running research prompt:', err);
    // Fallback to structured output on error
    return {
      topic,
      niche,
      language,
      main_fact: `${topic} is transforming the ${niche} domain.`,
      surprising_angle: `Strategic insights reveal hidden potential in ${topic}.`,
      example: `Used by top creators across India to engage audiences.`,
      statistic: `75%+ growth observed in ${niche} topics regarding ${topic}.`,
      takeaway: `Apply this key insight directly to your next project.`,
      isMock: true,
    };
  }
}
