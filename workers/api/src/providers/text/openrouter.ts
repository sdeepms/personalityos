const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'qwen/qwen3-32b'

type OpenRouterResponse = {
  choices: Array<{ message: { content: string } }>
}

export type TextResult = {
  text: string
  provider: string
  model: string
  durationMs: number
}

function extractJSON(text: string): string {
  // Remove thinking tags (Qwen3 chain-of-thought)
  const noThink = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()

  // Try ```json fence first
  const fenceMatch = noThink.match(/```json\s*([\s\S]*?)\s*```/)
  if (fenceMatch) return fenceMatch[1]

  // Try to find first { to last }
  const start = noThink.indexOf('{')
  const end = noThink.lastIndexOf('}')
  if (start !== -1 && end !== -1) {
    return noThink.slice(start, end + 1)
  }

  return noThink
}

export class OpenRouterAdapter {
  constructor(private apiKey: string) {}

  async generateText(systemPrompt: string, userPrompt: string): Promise<TextResult> {
    const startMs = Date.now()

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`OpenRouter request failed (${res.status}): ${text}`)
    }

    const data = await res.json() as OpenRouterResponse
    const rawText = data.choices?.[0]?.message?.content
    if (!rawText) throw new Error('OpenRouter returned empty response')

    console.log('Raw LLM response:', rawText)

    return { text: extractJSON(rawText), provider: 'qwen3_32b', model: MODEL, durationMs: Date.now() - startMs }
  }
}
