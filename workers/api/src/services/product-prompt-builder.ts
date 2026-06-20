export type ProductCategory =
  | 'clothing'
  | 'jewellery_face'
  | 'jewellery_wrist'
  | 'watch'
  | 'footwear'
  | 'bag'
  | 'eyewear'
  | 'electronics'
  | 'general'

type CharacterContext = {
  gender: string
  nationality: string
  age_range: string
  style_preset: string
  character_type: string
}

const CATEGORY_KEYWORDS: Record<Exclude<ProductCategory, 'general'>, string[]> = {
  clothing:        ['kurti', 'saree', 'sari', 'dress', 'shirt', 'top', 'blouse', 'jacket', 'blazer', 'kurta', 'lehenga', 'outfit', 'cloth', 'skirt', 'trouser', 'pant', 'suit', 'sherwani', 'salwar'],
  jewellery_face:  ['necklace', 'earring', 'pendant', 'chain', 'choker', 'maang tikka', 'nose ring', 'haar'],
  jewellery_wrist: ['bangle', 'bracelet', 'kangan', 'kada', 'wristband'],
  watch:           ['watch', 'timepiece', 'smartwatch'],
  footwear:        ['shoe', 'sandal', 'heel', 'boot', 'slipper', 'footwear', 'chappal', 'jutti', 'sneaker'],
  bag:             ['bag', 'purse', 'handbag', 'clutch', 'tote', 'wallet', 'backpack', 'sling'],
  eyewear:         ['glass', 'sunglass', 'spectacle', 'eyewear', 'lens'],
  electronics:     ['phone', 'mobile', 'laptop', 'tablet', 'earphone', 'earbud', 'headphone', 'gadget'],
}

export function detectProductCategory(label: string): ProductCategory {
  const lower = label.toLowerCase()
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS) as [Exclude<ProductCategory, 'general'>, string[]][]) {
    if (keywords.some(kw => lower.includes(kw))) return category
  }
  return 'general'
}

export function buildProductPrompt(
  productLabel: string,
  category: ProductCategory,
  character: CharacterContext,
): string {
  const genderDesc =
    character.gender === 'female' ? 'woman' :
    character.gender === 'male'   ? 'man'   : 'person'

  const styleDesc =
    character.style_preset === 'warm'         ? 'warm and approachable' :
    character.style_preset === 'professional' ? 'polished and professional' :
    character.style_preset === 'festive'      ? 'vibrant and stylish' :
    'stylish and confident'

  const charDesc =
    `${character.nationality} ${genderDesc} model, ${styleDesc}, in their ${character.age_range}`

  switch (category) {
    case 'clothing':
      return (
        `Professional fashion photography of a ${charDesc} ` +
        `wearing the exact outfit shown in the reference image, ` +
        `the clothing fits perfectly and drapes naturally on the model, ` +
        `full body or three-quarter shot, confident pose, ` +
        `clean studio background with soft professional lighting, ` +
        `high detail fabric texture clearly visible, ` +
        `commercial catalog quality, sharp focus, ` +
        `the outfit color and pattern matches the reference exactly, ` +
        `realistic, photographic quality`
      )

    case 'jewellery_face':
      return (
        `Professional beauty photography of a ${charDesc} ` +
        `wearing the exact jewellery shown in the reference image, ` +
        `close-up or medium shot with face clearly visible, ` +
        `the jewellery piece is prominently featured and accurately reproduced, ` +
        `exact design details, metal finish, and gemstones match the reference, ` +
        `soft flattering studio lighting, clean neutral background, ` +
        `commercial jewelry advertising quality, sharp focus, ` +
        `realistic, photographic`
      )

    case 'jewellery_wrist':
      return (
        `Professional product photography of a ${charDesc} ` +
        `wearing the exact bracelet or bangle shown in the reference image, ` +
        `wrist and forearm clearly visible in frame, ` +
        `the jewellery piece accurately reproduced with exact design details, ` +
        `elegant pose highlighting the wrist piece, ` +
        `soft studio lighting, clean background, ` +
        `commercial jewelry quality, sharp focus on the product, ` +
        `realistic, photographic`
      )

    case 'watch':
      return (
        `Professional commercial photography of a ${charDesc} ` +
        `wearing the exact watch shown in the reference image on their wrist, ` +
        `wrist clearly visible, watch face and details sharply rendered, ` +
        `exact watch design, dial, strap material and color match reference, ` +
        `elegant confident pose, one hand raised or extended naturally, ` +
        `clean neutral background, soft professional lighting, ` +
        `luxury watch advertisement quality, sharp focus on timepiece, ` +
        `realistic, photographic`
      )

    case 'footwear':
      return (
        `Professional fashion photography of a ${charDesc} ` +
        `wearing the exact shoes shown in the reference image, ` +
        `full body or lower body shot clearly showing the footwear, ` +
        `exact shoe design, color, and style matches reference, ` +
        `confident natural standing or walking pose, ` +
        `clean studio background, professional lighting, ` +
        `footwear is the focal point, clearly visible, ` +
        `commercial catalog quality, sharp focus, ` +
        `realistic, photographic`
      )

    case 'bag':
      return (
        `Professional fashion photography of a ${charDesc} ` +
        `holding or carrying the exact bag shown in the reference image, ` +
        `bag prominently featured and accurately reproduced, ` +
        `exact bag design, color, hardware and texture match reference, ` +
        `natural confident pose with the bag clearly visible, ` +
        `clean studio background, professional lighting, ` +
        `luxury accessories advertising quality, sharp focus on bag, ` +
        `realistic, photographic`
      )

    case 'eyewear':
      return (
        `Professional beauty photography of a ${charDesc} ` +
        `wearing the exact sunglasses or eyewear shown in the reference image, ` +
        `face clearly visible, eyewear prominently featured, ` +
        `exact frame design, color and lens match reference, ` +
        `confident pose, face turned slightly for best eyewear visibility, ` +
        `clean bright background, professional studio lighting, ` +
        `eyewear advertisement quality, sharp focus, ` +
        `realistic, photographic`
      )

    case 'electronics':
      return (
        `Professional commercial photography of a ${charDesc} ` +
        `holding the exact product shown in the reference image, ` +
        `product prominently featured in hand, screen or design clearly visible, ` +
        `exact product design, color and details match reference, ` +
        `natural confident pose, product at natural holding position, ` +
        `clean neutral background, professional studio lighting, ` +
        `tech advertisement quality, sharp focus on product, ` +
        `realistic, photographic`
      )

    default:
      return (
        `Professional commercial photography of a ${charDesc} ` +
        `featuring the product shown in the reference image, ` +
        `product prominently and accurately shown, ` +
        `exact product design and color match reference image, ` +
        `confident natural pose, product clearly visible, ` +
        `clean studio background, professional lighting, ` +
        `commercial advertising quality, sharp focus, ` +
        `realistic, photographic`
      )
  }
}
