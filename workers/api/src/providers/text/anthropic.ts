const ENDPOINT = 'https://api.anthropic.com/v1/messages'
const MODEL = 'claude-sonnet-4-5'

type AnthropicResponse = {
  content: Array<{ type: string; text: string }>
}

export type TextResult = {
  text: string
  provider: string
  model: string
  durationMs: number
}

export class AnthropicAdapter {
  constructor(private apiKey: string) {}

  async generateText(systemPrompt: string, userPrompt: string): Promise<TextResult> {
    const startMs = Date.now()

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Anthropic request failed (${res.status}): ${text}`)
    }

    const data = await res.json() as AnthropicResponse
    const content = data.content?.find((b) => b.type === 'text')?.text
    if (!content) throw new Error('Anthropic returned empty response')

    return { text: content, provider: 'claude_sonnet', model: MODEL, durationMs: Date.now() - startMs }
  }
}
