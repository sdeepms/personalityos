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

function extractJSON(text: string): string {
  // Remove thinking tags
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
    const rawText = data.content?.find((b) => b.type === 'text')?.text
    if (!rawText) throw new Error('Anthropic returned empty response')

    return { text: extractJSON(rawText), provider: 'claude_sonnet', model: MODEL, durationMs: Date.now() - startMs }
  }
}
