export type PortraitPromptData = {
  character_type: 'educator' | 'creator' | 'reseller'
  name: string
  domain?: string
  store_name?: string
  product_category?: string
  gender: string
  age_range: string
  nationality: string
  style_preset: string
}

const STYLE_DESCRIPTIONS: Record<string, Record<string, string>> = {
  educator: {
    engaging_explainer: 'energetic and approachable',
    academic_accessible: 'formal and authoritative',
    direct_mentor: 'confident and decisive',
  },
  creator: {
    relatable: 'casual and relatable',
    motivational: 'energetic and inspiring',
    opinion_bold: 'confident and bold',
    aesthetic: 'elegant and stylish',
    educational: 'smart and engaging',
  },
  reseller: {
    warm: 'warm and friendly',
    professional: 'polished and professional',
    festive: 'vibrant and celebratory',
  },
}

export function getStyleDescription(character_type: string, style_preset: string): string {
  return STYLE_DESCRIPTIONS[character_type]?.[style_preset] ?? 'professional and engaging'
}

export function assemblePortraitPrompt(data: PortraitPromptData): string {
  const { character_type, nationality, gender, age_range, style_preset, domain } = data
  const style_description = getStyleDescription(character_type, style_preset)

  if (character_type === 'educator') {
    return (
      `Professional portrait of a ${nationality} ${gender} educator ` +
      `in their ${age_range}, ${style_description}, expert in ${domain ?? 'their field'}, ` +
      `confident and approachable expression, professional attire, ` +
      `clean background, studio lighting, high quality photography, ` +
      `sharp focus, suitable for educational content creation, ` +
      `realistic, photographic`
    )
  }

  if (character_type === 'creator') {
    return (
      `Professional portrait of a ${nationality} ${gender} content ` +
      `creator in their ${age_range}, ${style_description}, ` +
      `lifestyle and personal brand photography, engaging expression, ` +
      `modern casual professional attire, clean background, ` +
      `natural lighting, high quality photography, ` +
      `suitable for social media content, realistic, photographic`
    )
  }

  // reseller
  return (
    `Professional portrait of a ${nationality} ${gender} model ` +
    `in their ${age_range}, warm friendly expression, ` +
    `${style_description}, clean studio background, ` +
    `commercial photography quality, suitable for product ` +
    `brand ambassador content, professional lighting, ` +
    `sharp focus, realistic, photographic`
  )
}
