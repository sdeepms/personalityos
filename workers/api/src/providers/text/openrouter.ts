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
    const content = data.choices?.[0]?.message?.content
    if (!content) throw new Error('OpenRouter returned empty response')

    return { text: content, provider: 'qwen3_32b', model: MODEL, durationMs: Date.now() - startMs }
  }
}
