import type { GenerationProvider, ImageOptions, GenerationResult } from '../interface'
import { getModelById, getDefaultModel } from '../models'

const MUAPI_HOST = 'https://api.muapi.ai'
const MUAPI_POLL_BASE = `${MUAPI_HOST}/api/v1/predictions`
const POLL_INTERVAL_MS = 4000
const MAX_ATTEMPTS = 15 // 60 seconds — flux-2-klein-4b-turbo-edit completes in ~15s

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

function mapAspectRatio(ratio: string): string {
  const supported: Record<string, string> = {
    '1:1':  '1:1',
    '16:9': '16:9',
    '9:16': '9:16',
    '4:5':  '3:4',  // LinkedIn — closest supported
    '4:3':  '4:3',
    '3:4':  '3:4',
    '21:9': '21:9',
    '9:21': '9:21',
  }
  return supported[ratio] ?? '1:1'
}

type MuAPIUploadResponse = { url: string }
type MuAPIGenerateResponse = { request_id: string }
type MuAPIStatusResponse = {
  status: 'processing' | 'completed' | 'failed'
  outputs?: string[]
  output?: { url: string; base64?: string }
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
    const aspectRatioStr = mapAspectRatio(options.aspectRatio)
    console.log('[muapi] generateImage start — model:', model.id, 'aspect:', options.aspectRatio, `${width}x${height}`)
    console.log('[muapi] referenceImageUrl:', options.referenceImageUrl ?? 'none')

    // Step 1 — resolve reference image to a MuAPI-accessible CDN URL
    let referenceImageUrl: string | undefined
    if (options.referenceImageUrl) {
      console.log('[muapi] uploading reference image to MuAPI CDN...')
      referenceImageUrl = await this.uploadReferenceToMuAPI(options.referenceImageUrl)
      console.log('[muapi] reference uploaded, cdnUrl:', referenceImageUrl)
    }

    // Step 2 — submit generation job
    // With reference image: nano-banana-edit — fast (~15s), face-consistent
    // Without reference image: flux-dev-image — plain text-to-image
    const submitEndpoint = referenceImageUrl
      ? `${MUAPI_HOST}/api/v1/nano-banana-edit`
      : `${MUAPI_HOST}${model.endpoint}`

    const submitBody = referenceImageUrl
      ? { prompt, images_list: [referenceImageUrl], aspect_ratio: aspectRatioStr }
      : { prompt, width, height, num_images: 1 }

    console.log('[muapi] submitting to:', submitEndpoint)
    const generateRes = await fetch(submitEndpoint, {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(submitBody),
    })

    if (!generateRes.ok) {
      const text = await generateRes.text()
      console.error('[muapi] generate request failed:', generateRes.status, text)
      throw new Error(`MuAPI generate request failed (${generateRes.status}): ${text}`)
    }

    const { request_id } = await generateRes.json() as MuAPIGenerateResponse
    if (!request_id) throw new Error('MuAPI did not return a request_id')
    console.log('[muapi] job submitted, request_id:', request_id)

    // Step 3 — poll for completion
    let attempts = 0
    let imageUrl: string | null = null
    let imageBase64: string | undefined

    while (attempts < MAX_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS))

      const statusRes = await fetch(`${MUAPI_POLL_BASE}/${request_id}/result`, {
        headers: { 'x-api-key': this.apiKey },
      })

      if (!statusRes.ok) {
        attempts++
        continue
      }

      const status = await statusRes.json() as MuAPIStatusResponse

      if (status.status === 'completed') {
        const outputUrl = status.output?.url ?? status.outputs?.[0]
        const imageBase64Result = status.output?.base64 ?? null
        if (!outputUrl) throw new Error('MuAPI completed but returned no image URL')
        imageUrl = outputUrl
        imageBase64 = imageBase64Result ?? undefined
        break
      }

      if (status.status === 'failed') {
        throw new Error(`MuAPI generation failed: ${status.error ?? 'unknown error'}`)
      }

      attempts++
    }

    if (!imageUrl) throw new Error('MuAPI generation timed out after 60 seconds')

    return {
      outputUrl: imageUrl,
      imageBase64,
      provider: 'muapi',
      model: model.id,
      durationMs: Date.now() - startMs,
      costUsdCents: 0,
    }
  }
}
