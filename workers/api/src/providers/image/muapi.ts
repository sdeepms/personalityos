import { nanoid } from 'nanoid'
import type { GenerationProvider, ImageOptions, GenerationResult } from '../interface'
import { getModelById, getDefaultModel } from '../models'

const MUAPI_HOST = 'https://api.muapi.ai'
const MUAPI_STATUS_URL = `${MUAPI_HOST}/api/v1/status`
const POLL_INTERVAL_MS = 3000
const MAX_ATTEMPTS = 30 // 90 seconds max

type AspectDimensions = { width: number; height: number }

function resolveDimensions(aspectRatio: string): AspectDimensions {
  const map: Record<string, AspectDimensions> = {
    '1:1':  { width: 1024, height: 1024 },
    '9:16': { width: 832,  height: 1216 },
    '16:9': { width: 1216, height: 832  },
    '4:5':  { width: 912,  height: 1136 },
  }
  return map[aspectRatio] ?? { width: 1024, height: 1024 }
}

type MuAPIUploadResponse = { url: string }
type MuAPIGenerateResponse = { request_id: string }
type MuAPIStatusResponse = {
  status: 'pending' | 'processing' | 'completed' | 'failed'
  result?: { url: string }
  error?: string
}

export class MuAPIAdapter implements GenerationProvider {
  name = 'muapi'

  constructor(
    private apiKey: string,
    private r2Bucket: R2Bucket,
    private workerUrl: string
  ) {}

  // Step 1 — Upload a reference image to MuAPI's CDN so it has a publicly accessible URL.
  // If the path is an R2 key (starts with "identity/"), fetch the bytes from our R2 bucket
  // and POST them to /upload_file. If it's already an https:// URL, use it as-is.
  private async uploadReferenceToMuAPI(refPath: string): Promise<string> {
    if (refPath.startsWith('https://') || refPath.startsWith('http://')) {
      return refPath
    }

    // Fetch from local R2 binding
    const obj = await this.r2Bucket.get(refPath)
    if (!obj) throw new Error(`Reference image not found in R2: ${refPath}`)

    const bytes = await obj.arrayBuffer()
    const contentType = obj.httpMetadata?.contentType ?? 'image/jpeg'

    // Derive a filename from the R2 key
    const filename = refPath.split('/').pop() ?? 'reference.jpg'

    const formData = new FormData()
    formData.append('file', new Blob([bytes], { type: contentType }), filename)

    const uploadRes = await fetch(`${MUAPI_HOST}/api/v1/upload_file`, {
      method: 'POST',
      headers: { 'x-api-key': this.apiKey },
      body: formData,
    })

    if (!uploadRes.ok) {
      const text = await uploadRes.text()
      throw new Error(`MuAPI upload_file failed (${uploadRes.status}): ${text}`)
    }

    const { url } = await uploadRes.json() as MuAPIUploadResponse
    if (!url) throw new Error('MuAPI upload_file did not return a URL')
    return url
  }

  async generateImage(prompt: string, options: ImageOptions): Promise<GenerationResult> {
    const startMs = Date.now()

    const model = (options.model ? getModelById(options.model) : undefined) ?? getDefaultModel()
    const { width, height } = resolveDimensions(options.aspectRatio)

    // Step 1 — resolve reference image to a MuAPI-accessible CDN URL
    const rawRefs = options.referenceImageUrls ?? []
    const referenceImageUrl = rawRefs.length > 0
      ? await this.uploadReferenceToMuAPI(rawRefs[0])
      : undefined

    // Step 2 — submit generation job to model-specific endpoint
    const generateRes = await fetch(`${MUAPI_HOST}${model.endpoint}`, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt,
        negative_prompt: options.negativePrompt ?? '',
        width,
        height,
        ...(referenceImageUrl ? { reference_image: referenceImageUrl } : {}),
      }),
    })

    if (!generateRes.ok) {
      const text = await generateRes.text()
      throw new Error(`MuAPI generate request failed (${generateRes.status}): ${text}`)
    }

    const { request_id } = await generateRes.json() as MuAPIGenerateResponse
    if (!request_id) throw new Error('MuAPI did not return a request_id')

    // Step 3 — poll for completion
    let attempts = 0
    let imageUrl: string | null = null

    while (attempts < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

      const statusRes = await fetch(`${MUAPI_STATUS_URL}/${request_id}`, {
        headers: { 'x-api-key': this.apiKey },
      })

      if (!statusRes.ok) {
        attempts++
        continue
      }

      const status = await statusRes.json() as MuAPIStatusResponse

      if (status.status === 'completed') {
        if (!status.result?.url) throw new Error('MuAPI completed but returned no image URL')
        imageUrl = status.result.url
        break
      }

      if (status.status === 'failed') {
        throw new Error(`MuAPI generation failed: ${status.error ?? 'unknown error'}`)
      }

      attempts++
    }

    if (!imageUrl) throw new Error('MuAPI generation timed out after 90 seconds')

    // Step 4 — download from MuAPI CDN and re-upload to our R2 (CDN URLs expire)
    const imageRes = await fetch(imageUrl)
    if (!imageRes.ok) throw new Error(`Failed to download generated image (${imageRes.status})`)
    const imageBuffer = await imageRes.arrayBuffer()

    const folder = options.userId && options.characterId
      ? `generations/${options.userId}/${options.characterId}`
      : 'generations/unknown'
    const r2Key = `${folder}/${nanoid()}.png`

    await this.r2Bucket.put(r2Key, imageBuffer, {
      httpMetadata: { contentType: 'image/png' },
    })

    return {
      outputUrl: r2Key,
      provider: 'muapi',
      model: model.id,
      durationMs: Date.now() - startMs,
      costUsdCents: 0,
    }
  }
}
