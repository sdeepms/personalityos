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

const STRONG_NEGATIVE_PROMPT = [
  'cartoon', 'anime', 'illustration', 'painting',
  'blurry', 'low quality', 'low resolution',
  'deformed', 'ugly', 'bad anatomy',
  'extra limbs', 'extra fingers', 'six fingers',
  'seven fingers', 'fused fingers',
  'fingers merged into objects',
  'fingers through objects',
  'wrong number of fingers',
  'mutated hands', 'malformed hands',
  'floating limbs', 'disconnected limbs',
  'different person', 'different face',
  'different hairstyle', 'different clothing style',
  'changed outfit', 'different outfit',
  'suit when reference shows kurta',
  'formal wear when reference shows casual',
  'casual wear when reference shows formal',
  'text on whiteboard', 'illegible text',
  'garbled writing', 'words on board',
  'watermark', 'signature', 'logo',
  'nsfw', 'nudity', 'violence',
  'overexposed', 'underexposed',
  'grainy', 'noisy', 'artifacts',
  'bad proportions', 'unrealistic proportions',
  'skin color mismatch',
  'different ethnicity than reference',
].join(', ')

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

  let prompt: string
  let negative_prompt: string

  if (primaryRef) {
    const promptParts = [
      userDescription,
      character.visual_style_prompt,
      'hyperrealistic photography',
      'same person as reference image',
      'identical facial features as reference',
      'same hairstyle as reference',
      'same clothing style as reference',
      ...(dna.style_modifiers ?? []),
      dna.color_palette ?? '',
      '85mm lens, f/1.8 aperture',
      'sharp focus on face',
      'cinematic lighting',
      'five fingers on each hand',
      'anatomically correct hands',
      'professional photography',
    ]
    prompt = promptParts.filter(Boolean).join(', ')
    negative_prompt = STRONG_NEGATIVE_PROMPT
  } else {
    const promptParts = [
      userDescription,
      character.visual_style_prompt,
      ...(dna.style_modifiers ?? []),
      dna.color_palette ?? '',
    ]
    prompt = promptParts.filter(Boolean).join(', ')
    negative_prompt = dna.negative_prompt ?? ''
  }

  return {
    prompt,
    negative_prompt,
    aspect_ratio: dna.aspect_preferences?.[platform] ?? '1:1',
    reference_image_url: primaryRef?.url ?? null,
    model: dna.provider_overrides?.muapi?.model ?? 'flux-dev',
  }
}
