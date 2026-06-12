type ReferenceImage = {
  url: string
  pose_type: string
  is_primary: boolean
}

type PromptDNA = {
  style_modifiers?: string[]
  negative_prompt?: string
  color_palette?: string
  aspect_preferences?: Record<string, string>
  provider_overrides?: { muapi?: { model?: string } }
}

export type CharacterForPrompt = {
  visual_style_prompt: string | null
  prompt_dna: string
  reference_image_urls: string
}

export type AssembledPrompt = {
  prompt: string
  negative_prompt: string
  aspect_ratio: string
  reference_image_url: string | null
  model: string
}

export function assembleImagePrompt(
  character: CharacterForPrompt,
  userDescription: string,
  platform: string
): AssembledPrompt {
  let dna: PromptDNA = {}
  try {
    dna = JSON.parse(character.prompt_dna)
  } catch {
    dna = {}
  }

  let refs: ReferenceImage[] = []
  try {
    refs = JSON.parse(character.reference_image_urls)
  } catch {
    refs = []
  }

  const primaryRef = refs.find((r) => r.is_primary) ?? refs[0] ?? null

  const promptParts = [
    userDescription,
    character.visual_style_prompt,
    ...(dna.style_modifiers ?? []),
    dna.color_palette ?? '',
  ]

  if (primaryRef) {
    promptParts.push('exact skin tone matching reference photo, consistent skin color, five fingers on each hand, no text visible on any surfaces')
  }

  const prompt = promptParts.filter(Boolean).join(', ')

  return {
    prompt,
    negative_prompt: dna.negative_prompt ?? '',
    aspect_ratio: dna.aspect_preferences?.[platform] ?? '1:1',
    reference_image_url: primaryRef?.url ?? null,
    model: dna.provider_overrides?.muapi?.model ?? 'flux-dev',
  }
}
