'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, Share2, Download, Copy, Check, ChevronLeft, ChevronRight, X, ChevronDown, MoreVertical, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

// ─── Types ────────────────────────────────────────────────────────────────────

type Character = {
  id: string
  name: string
  domain: string
  dna_ready: number
  reference_images_ready: number
  reference_image_urls: string
  character_type?: string | null
  gender?: string
  age_range?: string
  nationality?: string
  style_preset?: string
  created_at?: string
}

type ReferenceImage = {
  url: string
  pose_type: string
  is_primary: boolean
}

type HistoryItem = {
  id: string
  platform: string | null
  user_prompt: string | null
  text_output: string | null
  image_url: string | null
  generation_type: string
  created_at: string
  correlation_id: string | null
}

type LightboxImage = {
  url: string
  platform: string
  caption: string
  createdAt?: string
}

type ActiveGeneration = {
  localId: string
  platform: string
  message: string
  caption: string
  hashtags: string[]
  imageDescription: string
  imageUrl: string | null
  imageLoading: boolean
  imageFailed: boolean
  noReferenceImage: boolean
  imageLimitReached?: boolean
  generationId: string | null
  status: 'thinking' | 'caption_ready' | 'done' | 'error'
  createdAt?: string
  captionTimeS: string | null
  imageTimeS: string | null
  totalTimeS: string | null
}

type Offer = {
  id: string
  label: string
  description: string
}

type AttachmentType = 'product_image' | 'reference_image'

type Attachment = {
  id: string
  type: AttachmentType
  label: string
  public_url: string
  preview_url: string
  source: 'library' | 'fresh_upload'
}

type SavedProduct = {
  id: string
  name: string
  image_url: string
  public_url?: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { id: 'instagram', label: 'Instagram Post', prefix: 'Create an Instagram post about: ' },
  { id: 'linkedin',  label: 'LinkedIn Post',  prefix: 'Create a LinkedIn post about: '  },
  { id: 'x',         label: 'X Thread',        prefix: 'Create an X thread about: '      },
  { id: 'carousel',  label: 'Carousel',        prefix: 'Create a carousel about: '       },
  { id: 'story',     label: 'Story',           prefix: 'Create a story about: '          },
] as const

const PLATFORM_BADGE: Record<string, string> = {
  instagram: 'bg-gradient-to-r from-pink-600 to-purple-600 text-white',
  linkedin:  'bg-blue-600 text-white',
  x:         'bg-zinc-800 border border-zinc-600 text-white',
  carousel:  'bg-orange-600 text-white',
  story:     'bg-green-600 text-white',
  general:   'bg-zinc-700 text-white',
}

const PLATFORM_SHORTCUT: Record<string, string> = {
  instagram: 'border-pink-800   text-pink-400   hover:bg-pink-950/40   disabled:opacity-40',
  linkedin:  'border-blue-800   text-blue-400   hover:bg-blue-950/40   disabled:opacity-40',
  x:         'border-zinc-600   text-zinc-300   hover:bg-zinc-800/40   disabled:opacity-40',
  carousel:  'border-orange-800 text-orange-400 hover:bg-orange-950/40 disabled:opacity-40',
  story:     'border-green-800  text-green-400  hover:bg-green-950/40  disabled:opacity-40',
}

const ASPECT_LABEL: Record<string, string> = {
  instagram: '1:1',
  linkedin:  '4:5',
  x:         '16:9',
  carousel:  '1:1',
  story:     '9:16',
  general:   '1:1',
}

const IMAGE_PANEL_WIDTH: Record<string, string> = {
  instagram: 'w-64',
  linkedin:  'w-52',
  x:         'w-72',
  story:     'w-36',
  carousel:  'w-64',
  general:   'w-64',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

function PlatformBadge({ platform }: { platform: string }) {
  const cls = PLATFORM_BADGE[platform] ?? PLATFORM_BADGE.general
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {platform.charAt(0).toUpperCase() + platform.slice(1)}
    </span>
  )
}

function IconBtn({
  onClick, disabled, title, spinning, children,
}: {
  onClick: () => void; disabled?: boolean; title: string; spinning?: boolean; children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="flex h-7 w-7 items-center justify-center rounded-full border border-white bg-black text-white transition-colors hover:bg-zinc-900 hover:border-white disabled:opacity-40"
    >
      <span className={spinning ? 'animate-spin' : ''}>{children}</span>
    </button>
  )
}

function getDateLabel(dateStr: string): string {
  const d         = new Date(dateStr)
  const now       = new Date()
  const todayMs   = new Date(now.getFullYear(),  now.getMonth(),  now.getDate()).getTime()
  const itemMs    = new Date(d.getFullYear(),     d.getMonth(),    d.getDate()).getTime()
  const diffDays  = Math.round((todayMs - itemMs) / 86_400_000)
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7)   return d.toLocaleDateString('en-US', { weekday: 'long' })
  return d.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function resolveImageUrl(url: string | null): string | null {
  if (!url) return null
  if (url.startsWith('/files/')) return `${WORKER_URL}${url}`
  return url
}

function getIntentShortcuts(domain: string, characterType?: string | null): string[] {
  if (characterType === 'creator') {
    return [
      'Share an opinion',
      'Tell a story',
      'Trending topic',
      'Behind the scenes',
      'Lesson learned',
    ]
  }

  const d = domain.toLowerCase()
  if (d.includes('upsc') || d.includes('polity') || d.includes('governance'))
    return ['Explain a concept', 'Debunk a myth', 'Current affairs angle', 'Case study', 'Exam tip']
  if (d.includes('finance') || d.includes('invest') || d.includes('money'))
    return ['Market insight', 'Beginner explainer', 'Common mistake', 'Rule of thumb', 'Case study']
  if (d.includes('startup') || d.includes('entrepreneur') || d.includes('business'))
    return ['Founder lesson', 'Contrarian take', 'Framework', 'War story', 'Hiring tip']
  if (d.includes('coach') || d.includes('motivat') || d.includes('mindset'))
    return ['Morning motivation', 'Habit tip', 'Mindset shift', 'Client win', 'Hard truth']
  if (d.includes('history') || d.includes('culture'))
    return ['Hidden fact', 'Then vs now', 'Forgotten story', 'Myth buster', 'Legacy lesson']
  if (d.includes('science') || d.includes('tech') || d.includes('ai'))
    return ['Concept breakdown', 'Latest development', 'Common misconception', 'Analogy', 'Future prediction']
  if (d.includes('law') || d.includes('legal'))
    return ['Know your rights', 'Case breakdown', 'Common myth', 'Landmark judgment', 'Plain English']
  return ['Share an insight', 'Tell a story', 'Debunk a myth', 'Give a tip', 'Ask a question']
}

function buildInput(intent: string, platform: string): string {
  if (intent && platform) return `${platform} about: ${intent}: `
  if (intent)             return `${intent}: `
  if (platform)           return `${platform} about: `
  return ''
}

function formatStylePreset(preset?: string): string {
  if (!preset) return ''
  return preset.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function capitalize(str?: string): string {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ''
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Pairs text + image rows into combined cards.
 * Primary: same correlation_id. Fallback: platform + ≤120s (legacy rows).
 */
function pairHistoryItems(items: HistoryItem[]): ActiveGeneration[] {
  const textGens  = items.filter(i => i.generation_type === 'text')
  const imageGens = items.filter(i =>
    i.generation_type === 'image' ||
    i.generation_type === 'product_image' ||
    i.generation_type === 'product_photography'
  )
  const pairedImageIds = new Set<string>()
  const result: ActiveGeneration[] = []

  for (const t of textGens) {
    let match = t.correlation_id
      ? imageGens.find(img => !pairedImageIds.has(img.id) && img.correlation_id === t.correlation_id)
      : undefined

    if (!match && t.correlation_id === null) {
      match = imageGens.find(
        img =>
          !pairedImageIds.has(img.id) &&
          img.correlation_id === null &&
          img.platform === t.platform &&
          Math.abs(
            new Date(img.created_at).getTime() - new Date(t.created_at).getTime()
          ) <= 120_000
      )
    }

    if (match) pairedImageIds.add(match.id)

    result.push({
      localId:          t.id,
      platform:         t.platform ?? 'general',
      message:          t.user_prompt ?? '',
      caption:          t.text_output ?? '',
      hashtags:         [],
      imageDescription: t.user_prompt ?? '',
      imageUrl:         resolveImageUrl(match?.image_url ?? null),
      imageLoading:     false,
      imageFailed:      false,
      noReferenceImage: false,
      generationId:     t.id,
      status:           'done',
      createdAt:        t.created_at,
      captionTimeS:     null,
      imageTimeS:       null,
      totalTimeS:       null,
    })
  }

  for (const img of imageGens) {
    if (pairedImageIds.has(img.id)) continue
    result.push({
      localId:          img.id,
      platform:         img.platform ?? 'general',
      message:          img.user_prompt ?? '',
      caption:          '',
      hashtags:         [],
      imageDescription: img.user_prompt ?? '',
      imageUrl:         resolveImageUrl(img.image_url ?? null),
      imageLoading:     false,
      imageFailed:      false,
      noReferenceImage: false,
      generationId:     img.id,
      status:           'done',
      createdAt:        img.created_at,
      captionTimeS:     null,
      imageTimeS:       null,
      totalTimeS:       null,
    })
  }

  result.sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
  return result
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ThinkingIndicator() {
  return (
    <div className="flex items-center gap-2 px-4 py-3">
      <span className="text-sm text-[#a1a1aa]">Generating</span>
      <span className="flex gap-1">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-indigo-400 animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </span>
    </div>
  )
}

function ImageSkeleton({ platform }: { platform: string }) {
  const aspect = ASPECT_LABEL[platform] ?? '1:1'
  const [w, h] = aspect.split(':').map(Number)
  return (
    <div
      className="relative w-full overflow-hidden rounded-lg bg-[#1a1a1a] animate-pulse flex flex-col items-center justify-center gap-2"
      style={{ aspectRatio: `${w}/${h}` }}
    >
      <div className="h-7 w-7 rounded-full border-2 border-indigo-500/30 border-t-indigo-500 animate-spin" />
      <span className="text-xs text-[#71717a]">Generating image…</span>
    </div>
  )
}

function HistoryCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden animate-pulse">
      <div className="flex flex-col sm:flex-row">
        <div className="flex-[2] p-4 border-b border-[#1a1a1a] sm:border-b-0 sm:border-r">
          <div className="aspect-square w-full rounded-lg bg-[#1a1a1a]" />
        </div>
        <div className="flex-[3] p-4 flex flex-col gap-3">
          <div className="h-5 w-24 rounded-full bg-[#1a1a1a]" />
          <div className="space-y-2 flex-1">
            <div className="h-3 w-full rounded bg-[#1a1a1a]" />
            <div className="h-3 w-5/6 rounded bg-[#1a1a1a]" />
            <div className="h-3 w-4/6 rounded bg-[#1a1a1a]" />
            <div className="h-3 w-3/4 rounded bg-[#1a1a1a]" />
          </div>
          <div className="flex justify-end gap-1.5">
            <div className="h-7 w-7 rounded-full bg-[#1a1a1a]" />
            <div className="h-7 w-7 rounded-full bg-[#1a1a1a]" />
          </div>
        </div>
      </div>
    </div>
  )
}

function GenerationCard({
  gen,
  mode,
  characterName,
  characterId,
  token,
  sending,
  onUpdate,
  onSendingChange,
  onImageClick,
  onImagePanelClick,
  onRetry,
}: {
  gen: ActiveGeneration
  mode: 'history' | 'live'
  characterName: string
  characterId: string
  token: string | null
  sending: boolean
  onUpdate: (patch: Partial<ActiveGeneration>) => void
  onSendingChange: (v: boolean) => void
  onImageClick?: (image: LightboxImage) => void
  onImagePanelClick?: (gen: ActiveGeneration) => void
  onRetry?: () => void
}) {
  const [copied,              setCopied]              = useState(false)
  const [linkCopied,          setLinkCopied]          = useState(false)
  const [captionRegenerating, setCaptionRegenerating] = useState(false)
  const [imageRegenerating,   setImageRegenerating]   = useState(false)
  const [captionExpanded,     setCaptionExpanded]     = useState(false)

  const anyBusy = captionRegenerating || imageRegenerating || sending

  const displayHashtags = gen.hashtags.length > 0
    ? gen.hashtags.map(t => t.startsWith('#') ? t : `#${t}`)
    : (gen.caption.match(/#\w+/g) ?? [])

  async function copyCaption() {
    try {
      const fullText = gen.hashtags.length > 0
        ? gen.caption + '\n\n' + displayHashtags.join(' ')
        : gen.caption
      await navigator.clipboard.writeText(fullText)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* ignore */ }
  }

  async function downloadImage() {
    if (!gen.imageUrl) return
    try {
      const res  = await fetch(gen.imageUrl)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `${characterName}-${gen.platform}-${gen.localId.slice(0, 8)}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch { window.open(gen.imageUrl, '_blank') }
  }

  async function shareImage() {
    if (!gen.imageUrl) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Created with PersonalityOS', text: gen.caption || '', url: gen.imageUrl }) }
      catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(gen.imageUrl)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      } catch { /* ignore */ }
    }
  }

  async function regenerateCaption() {
    if (anyBusy || !token) return
    setCaptionRegenerating(true)
    onSendingChange(true)
    const start = Date.now()
    try {
      const res  = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ character_id: characterId, message: gen.message, platform: gen.platform }),
      })
      if (res.status === 401) { window.location.href = '/login'; return }
      const json = await res.json() as { data?: { caption: string; hashtags: string[] }; error?: string }
      if (!res.ok) throw new Error(json.error)
      const captionTimeS = ((Date.now() - start) / 1000).toFixed(1)
      onUpdate({ caption: json.data!.caption, hashtags: json.data!.hashtags ?? [], captionTimeS })
    } catch { /* silent */ }
    finally {
      setCaptionRegenerating(false)
      onSendingChange(false)
    }
  }

  // Synchronous regenerate: POST blocks until image is ready (~20-30s)
  async function regenerateImage() {
    if (anyBusy || !token) return
    setImageRegenerating(true)
    onSendingChange(true)
    onUpdate({ imageLoading: true, imageUrl: null, imageFailed: false, noReferenceImage: false, imageTimeS: null })
    const start = Date.now()

    try {
      const res = await fetch(`${WORKER_URL}/api/generate/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          character_id:      characterId,
          image_description: gen.imageDescription || gen.caption,
          user_prompt:       gen.message,
          platform:          gen.platform,
        }),
      })

      if (res.status === 401) { window.location.href = '/login'; return }

      const json = await res.json() as { data?: { image_url: string; generation_id: string | null }; error?: string; code?: string }

      if (res.status === 400 && json.code === 'REFERENCE_IMAGES_REQUIRED') {
        onUpdate({ imageLoading: false, noReferenceImage: true })
        return
      }
      if (!res.ok) throw new Error(json.error ?? 'Generation failed')

      const imageTimeS = ((Date.now() - start) / 1000).toFixed(1)
      onUpdate({ imageUrl: json.data!.image_url, imageLoading: false, imageTimeS })
    } catch {
      onUpdate({ imageLoading: false, imageFailed: true })
    } finally {
      setImageRegenerating(false)
      onSendingChange(false)
    }
  }

  // ── Live-mode status guards ────────────────────────────────────────────────
  if (mode === 'live' && gen.status === 'thinking') {
    return (
      <div className="rounded-xl border border-[#262626] bg-[#141414]">
        <ThinkingIndicator />
      </div>
    )
  }

  if (mode === 'live' && gen.status === 'error') {
    return (
      <div className="rounded-xl border border-red-900/50 bg-red-950/10 p-4 flex items-center justify-between gap-4">
        <p className="text-sm text-red-400">Something went wrong.</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="shrink-0 rounded-lg border border-red-800/50 bg-red-950/30 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-900/30 hover:text-red-300"
          >
            Retry
          </button>
        )}
      </div>
    )
  }

  // ── Image panel content (image only — no buttons) ────────────────────────
  const imagePanelContent = (() => {
    if (gen.imageLoading) return <ImageSkeleton platform={gen.platform} />

    if (gen.imageUrl) return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={gen.imageUrl}
        alt="Generated"
        className="w-full h-full object-cover cursor-pointer transition-all duration-200 hover:scale-[1.01]"
      />
    )

    if (gen.imageFailed) return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-red-900/40 p-6 text-center">
        <p className="text-xs text-red-400">Image generation failed.</p>
        <IconBtn onClick={regenerateImage} disabled={anyBusy} title="Retry image" spinning={imageRegenerating}>
          <RefreshCw size={13} />
        </IconBtn>
      </div>
    )

    if (gen.noReferenceImage) return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-yellow-900/40 bg-yellow-950/10 p-6 text-center">
        <p className="text-xs text-yellow-400/80">Add a reference photo to generate images.</p>
        <Link
          href={`/dashboard/settings?id=${characterId}`}
          className="rounded-lg border border-yellow-800/50 px-3 py-1.5 text-xs text-yellow-400 transition-colors hover:bg-yellow-950/40"
        >
          Add Photo
        </Link>
      </div>
    )

    if (gen.imageLimitReached) return (
      <p className="text-xs text-amber-400 text-center p-4">
        Daily image limit reached.
        Captions still available.
      </p>
    )

    return null
  })()

  const showImagePanel = gen.imageLoading || !!gen.imageUrl || gen.imageFailed || gen.noReferenceImage || !!gen.imageLimitReached

  // Caption-only card (no image panel)
  if (!showImagePanel) {
    return (
      <div className="rounded-lg border border-zinc-700 bg-zinc-900 p-4">
        <div className="mb-3 flex shrink-0 items-center justify-between gap-2">
          <PlatformBadge platform={gen.platform} />
          {(gen.totalTimeS ?? gen.captionTimeS) && (
            <span className="text-[10px] text-slate-400">Generated in {gen.totalTimeS ?? gen.captionTimeS}s</span>
          )}
        </div>
        {gen.caption ? (
          <div
            className="text-sm leading-relaxed text-slate-200 overflow-y-auto chat-scrollbar bg-slate-900/40 rounded-md px-2 py-1"
            style={{ maxHeight: '200px', userSelect: 'text', cursor: 'text' }}
          >
            {gen.caption.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </div>
        ) : (
          <p className="text-sm italic text-[#3a3a3a]">No caption available.</p>
        )}
        <div className="mt-3 flex items-center justify-end gap-1.5">
          <Button variant="ghost" size="icon"
            className={`h-8 w-8 rounded-full transition-all duration-200 ${
              copied
                ? 'border border-green-500 text-green-400 bg-green-500/10'
                : 'border border-zinc-600 text-white bg-transparent hover:bg-zinc-800 hover:border-zinc-400'
            }`}
            onClick={copyCaption} title="Copy">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <IconBtn onClick={regenerateCaption} disabled={anyBusy} title="Regenerate caption" spinning={captionRegenerating}>
            <RefreshCw size={13} />
          </IconBtn>
        </div>
      </div>
    )
  }

  const panelWidth = IMAGE_PANEL_WIDTH[gen.platform] ?? 'w-64'

  return (
    <div className="flex flex-col md:grid md:grid-cols-2 rounded-xl overflow-hidden border border-zinc-700 bg-zinc-900 md:h-[320px]">

      {/* LEFT — image, half width */}
      <div
        className="relative w-full flex-shrink-0 overflow-hidden cursor-pointer h-[320px] md:h-full"
        onClick={() => gen.imageUrl && onImagePanelClick?.(gen)}
      >
        {imagePanelContent}
        {gen.imageUrl && (
          <div className="absolute bottom-2 right-2 z-10 flex gap-1.5" onClick={e => e.stopPropagation()}>
            <button
              onClick={downloadImage}
              title="Download image"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 border border-white/30 text-white hover:bg-black hover:border-white"
            >
              <Download className="h-3 w-3" />
            </button>
            <button
              onClick={regenerateImage}
              disabled={anyBusy}
              title="Regenerate image"
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 border border-white/30 text-white hover:bg-black hover:border-white disabled:opacity-40"
            >
              <RefreshCw className={`h-3 w-3 ${imageRegenerating ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={shareImage}
              title={linkCopied ? 'Link copied!' : 'Share'}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-black/70 border border-white/30 text-white hover:bg-black hover:border-white"
            >
              {linkCopied
                ? <span className="text-[9px] font-medium text-green-400">✓</span>
                : <Share2 className="h-3 w-3" />
              }
            </button>
          </div>
        )}
      </div>

      {/* Mobile caption — hidden on desktop */}
      <div className="md:hidden">

        {/* Collapsed header — always visible */}
        <button
          onClick={() => setCaptionExpanded(v => !v)}
          className="w-full flex items-center justify-between px-4 py-3 border-t border-zinc-800">
          <div className="flex items-center gap-2 min-w-0">
            <PlatformBadge platform={gen.platform} />
            <span className="ml-2 text-sm text-slate-300 line-clamp-1 text-left flex-1 min-w-0">
              {gen.caption ? gen.caption.slice(0, 60) + (gen.caption.length > 60 ? '…' : '') : ''}
            </span>
          </div>
          <ChevronDown className={`ml-2 h-4 w-4 shrink-0 text-zinc-500 transition-transform ${captionExpanded ? 'rotate-180' : ''}`} />
        </button>

        {/* Expanded content */}
        {captionExpanded && (
          <div className="px-4 pb-4 border-t border-zinc-800 space-y-3">
            <p className="text-sm text-slate-200 leading-relaxed mt-3 whitespace-pre-wrap">
              {gen.caption}
            </p>
            {displayHashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {displayHashtags.map((tag, i) => (
                  <span key={i} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-indigo-400">
                    {tag}
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon"
                className={`h-8 w-8 rounded-full transition-all duration-200 ${
                  copied
                    ? 'border border-green-500 text-green-400 bg-green-500/10'
                    : 'border border-zinc-600 text-white bg-transparent hover:bg-zinc-800 hover:border-zinc-400'
                }`}
                onClick={copyCaption} title="Copy">
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
              <IconBtn onClick={regenerateCaption} disabled={anyBusy} title="Regenerate caption" spinning={captionRegenerating}>
                <RefreshCw size={13} />
              </IconBtn>
            </div>
          </div>
        )}

      </div>

      {/* RIGHT — caption panel */}
      <div className="hidden md:flex flex-col overflow-hidden p-4 gap-2 border-l border-zinc-800 min-h-0 h-full">

        {/* a) Badge + timing */}
        <div className="mb-2 flex shrink-0 items-center justify-between gap-2">
          <PlatformBadge platform={gen.platform} />
          {(gen.totalTimeS ?? gen.captionTimeS) && (
            <span className="text-[10px] text-slate-400">Generated in {gen.totalTimeS ?? gen.captionTimeS}s</span>
          )}
        </div>

        {/* b) Caption — scrollable, selectable */}
        {gen.caption ? (
          <div
            className="flex-1 min-h-0 overflow-y-auto text-sm text-slate-200 leading-relaxed scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent"
            style={{ userSelect: 'text', cursor: 'text' }}
          >
            {gen.caption.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </div>
        ) : (
          <p className="flex-1 text-sm italic text-[#3a3a3a]">No caption available.</p>
        )}

        {/* c) Hashtags */}
        {displayHashtags.length > 0 && (
          <div className="mb-2 flex shrink-0 flex-wrap gap-1.5">
            {displayHashtags.map((tag, i) => (
              <span key={i} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-indigo-400">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* d) Action buttons */}
        <div className="flex shrink-0 items-center justify-end gap-1.5">
          <Button variant="ghost" size="icon"
            className={`h-8 w-8 rounded-full transition-all duration-200 ${
              copied
                ? 'border border-green-500 text-green-400 bg-green-500/10'
                : 'border border-zinc-600 text-white bg-transparent hover:bg-zinc-800 hover:border-zinc-400'
            }`}
            onClick={copyCaption} title="Copy">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </Button>
          <IconBtn onClick={regenerateCaption} disabled={anyBusy} title="Regenerate caption" spinning={captionRegenerating}>
            <RefreshCw size={13} />
          </IconBtn>
        </div>

      </div>

    </div>
  )
}

// ─── Lightbox ─────────────────────────────────────────────────────────────────

function ImageLightbox({
  images,
  initialIndex = 0,
  onClose,
}: {
  images: LightboxImage[]
  initialIndex?: number
  onClose: () => void
}) {
  const [index,      setIndex]      = useState(initialIndex)
  const [linkCopied, setLinkCopied] = useState(false)
  const [visible,    setVisible]    = useState(false)

  const current = images[index]
  const total   = images.length

  useEffect(() => { requestAnimationFrame(() => setVisible(true)) }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape')     { onClose(); return }
      if (e.key === 'ArrowLeft')  setIndex(i => Math.max(0, i - 1))
      if (e.key === 'ArrowRight') setIndex(i => Math.min(total - 1, i + 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, total])

  async function downloadImage() {
    if (!current.url) return
    try {
      const res  = await fetch(current.url)
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href = url
      a.download = `personalityos-${current.platform}-${Date.now()}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch { window.open(current.url, '_blank') }
  }

  async function shareImage() {
    if (!current.url) return
    if (navigator.share) {
      try { await navigator.share({ title: 'Created with PersonalityOS', text: current.caption, url: current.url }) }
      catch { /* user cancelled */ }
    } else {
      try {
        await navigator.clipboard.writeText(current.url)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      } catch { /* ignore */ }
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/70 transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
      onClick={onClose}
    >
      <div
        className="relative flex flex-col rounded-2xl border border-[#262626] bg-[#141414] shadow-[0_32px_64px_rgba(0,0,0,0.8)] overflow-hidden"
        style={{ width: 'clamp(380px, 40vw, 100vw)', height: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex h-12 shrink-0 items-center justify-between border-b border-[#262626] px-4">
          <PlatformBadge platform={current.platform} />
          <span className="text-xs text-[#71717a]">{index + 1} of {total}</span>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-[#71717a] transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={16} />
          </button>
        </div>

        <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#0a0a0a]">
          {total > 1 && (
            <button
              onClick={() => setIndex(i => Math.max(0, i - 1))}
              disabled={index === 0}
              className="absolute left-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 disabled:opacity-30"
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={current.url} src={current.url} alt="Preview" className="h-full w-full object-contain" />
          {total > 1 && (
            <button
              onClick={() => setIndex(i => Math.min(total - 1, i + 1))}
              disabled={index === total - 1}
              className="absolute right-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white transition hover:bg-black/60 disabled:opacity-30"
            >
              <ChevronRight size={20} />
            </button>
          )}
        </div>

        <div className="flex h-12 shrink-0 items-center justify-between border-t border-[#262626] px-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-[#71717a]">{ASPECT_LABEL[current.platform] ?? '1:1'}</span>
            {current.createdAt && (
              <span className="text-[10px] text-[#3a3a3a]">
                {new Date(current.createdAt).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn onClick={shareImage} title={linkCopied ? 'Link copied!' : 'Share'}>
              {linkCopied
                ? <span className="text-[10px] font-medium text-green-400">✓</span>
                : <Share2 size={13} />
              }
            </IconBtn>
            <IconBtn onClick={downloadImage} title="Download image">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="7 10 12 15 17 10"/>
                <line x1="12" y1="15" x2="12" y2="3"/>
              </svg>
            </IconBtn>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ChatClient() {
  const searchParams = useSearchParams()
  const characterId  = searchParams.get('id')
  const router       = useRouter()
  const supabase     = createClient()

  const [character,       setCharacter]     = useState<Character | null>(null)
  const [offers,          setOffers]        = useState<Offer[]>([])
  const [charLoading,     setCharLoading]   = useState(true)
  const [historyGens,     setHistoryGens]   = useState<ActiveGeneration[]>([])
  const [historyLoading,  setHistoryLoading]= useState(true)
  const [generationCount, setGenerationCount] = useState(0)
  const [generations,     setGenerations]   = useState<ActiveGeneration[]>([])
  const [input,           setInput]         = useState('')
  const [activePlatform,  setActivePlatform]= useState<string | null>(null)
  const [intentPrefix,    setIntentPrefix]  = useState('')
  const [platformPrefix,  setPlatformPrefix]= useState('')
  const [sending,         setSending]       = useState(false)
  const [token,           setToken]         = useState<string | null>(null)
  const [avatarError,     setAvatarError]   = useState(false)
  const [lightbox,             setLightbox]             = useState<{ images: LightboxImage[]; index: number } | null>(null)
  const [modalGeneration,      setModalGeneration]      = useState<ActiveGeneration | null>(null)
  const [modalCaptionExpanded, setModalCaptionExpanded] = useState(false)

  const [captionLimitHit,    setCaptionLimitHit]    = useState(false)
  const [imageLimitHit,      setImageLimitHit]      = useState(false)
  const [showFeedbackForm,   setShowFeedbackForm]   = useState(false)
  const [feedbackText,       setFeedbackText]       = useState('')
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false)
  const [feedbackSubmitted,  setFeedbackSubmitted]  = useState(false)

  const scrollRef              = useRef<HTMLDivElement>(null)
  const textareaRef            = useRef<HTMLTextAreaElement>(null)
  const menuRef                = useRef<HTMLDivElement>(null)
  const attachmentPickerRef    = useRef<HTMLDivElement>(null)
  const attachmentFileInputRef = useRef<HTMLInputElement>(null)

  const [menuOpen,              setMenuOpen]              = useState(false)
  const [showProfile,           setShowProfile]           = useState(false)
  const [attachments,           setAttachments]           = useState<Attachment[]>([])
  const [showAttachmentPicker,  setShowAttachmentPicker]  = useState(false)
  const [savedProducts,         setSavedProducts]         = useState<SavedProduct[]>([])
  const [pickerLoading,         setPickerLoading]         = useState(false)
  const [attachmentError,       setAttachmentError]       = useState<string | null>(null)
  const [pickerProductName,     setPickerProductName]     = useState('')
  const [pendingProductName,    setPendingProductName]    = useState('')

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 128) + 'px'
  }, [input])

  useEffect(() => {
    if (historyLoading) return
    const delays = [50, 150, 300, 600]
    const timers = delays.map(d => setTimeout(scrollToBottom, d))
    return () => timers.forEach(clearTimeout)
  }, [historyLoading, scrollToBottom])

  useEffect(() => {
    if (generations.length === 0) return
    const t = setTimeout(scrollToBottom, 100)
    return () => clearTimeout(t)
  }, [generations.length, scrollToBottom])

  useEffect(() => {
    setModalCaptionExpanded(false)
  }, [modalGeneration])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (attachmentPickerRef.current && !attachmentPickerRef.current.contains(e.target as Node)) {
        setShowAttachmentPicker(false)
        setPickerProductName('')
      }
    }
    if (showAttachmentPicker) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [showAttachmentPicker])

  useEffect(() => {
    if (!characterId) { router.replace('/dashboard'); return }
    const supabase = createClient()

    async function init() {
      // Auth check first — getSession() reads from localStorage, no network needed
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
        return
      }

      setToken(session.access_token)

      try {
        const [charRes, histRes, countRes] = await Promise.all([
          fetch(`${WORKER_URL}/api/characters/${characterId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${WORKER_URL}/api/library?character_id=${characterId}&limit=40`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
          fetch(`${WORKER_URL}/api/library?character_id=${characterId}&type=text&limit=1`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ])

        if (charRes.status === 401 || histRes.status === 401) {
          router.push('/login')
          return
        }

        if (!charRes.ok) { router.replace('/dashboard'); return }

        const charJson = await charRes.json() as { data: Character }
        const char = charJson.data

        if (char.dna_ready === 0) { router.replace('/dashboard'); return }

        setCharacter(char)

        if (histRes.ok) {
          const histJson = await histRes.json() as { data?: HistoryItem[] }
          setHistoryGens(pairHistoryItems(histJson.data ?? []))
        }

        if (countRes.ok) {
          const countJson = await countRes.json() as { meta?: { total: number } }
          setGenerationCount(countJson.meta?.total ?? 0)
        }
      } catch (err) {
        console.error('[ChatClient] init fetch error:', err)
      } finally {
        setCharLoading(false)
        setHistoryLoading(false)
      }
    }

    init()
  }, [characterId, router])

  function selectPlatform(platformId: string) {
    if (sending) return
    const p = PLATFORMS.find(pl => pl.id === platformId)
    if (!p) return
    const platformText    = p.prefix.replace(/ about: $/, '')
    const isToggle        = platformPrefix === platformText
    const newPlatformText = isToggle ? '' : platformText
    const newPlatformId   = isToggle ? null : platformId
    setPlatformPrefix(newPlatformText)
    setActivePlatform(newPlatformId)
    const newInput = buildInput(intentPrefix, newPlatformText)
    setInput(newInput)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(newInput.length, newInput.length)
      }
    }, 0)
  }

  // Synchronous image generation: awaits POST directly (~20-30s), then updates state
  async function startImageGeneration(
    localId: string,
    charId: string,
    imageDescription: string,
    message: string,
    platform: string,
    correlationId: string,
    authToken: string,
    generationStart: number,
  ) {
    const start = Date.now()
    try {
      const res = await fetch(`${WORKER_URL}/api/generate/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          character_id:      charId,
          image_description: imageDescription,
          user_prompt:       message,
          platform,
          correlation_id:    correlationId,
          attachments: attachments.map(a => ({ type: a.type, public_url: a.public_url, label: a.label })),
        }),
      })

      if (res.status === 401) { router.replace('/login'); return }

      const json = await res.json() as { data?: { image_url: string; generation_id: string | null }; error?: string; code?: string }

      if (res.status === 400 && json.code === 'REFERENCE_IMAGES_REQUIRED') {
        setGenerations(prev => prev.map(g =>
          g.localId === localId
            ? { ...g, imageLoading: false, noReferenceImage: true, status: 'done' }
            : g
        ))
        return
      }

      if (res.status === 429 || json.code === 'IMAGE_LIMIT_REACHED') {
        setImageLimitHit(true)
        setGenerations(prev => prev.map(g =>
          g.localId === localId
            ? { ...g, imageLoading: false, imageLimitReached: true, status: 'done' }
            : g
        ))
        return
      }

      if (!res.ok) throw new Error(json.error ?? 'Image request failed')

      const imageTimeS = ((Date.now() - start) / 1000).toFixed(1)
      const totalTimeS = ((Date.now() - generationStart) / 1000).toFixed(1)
      const cdnUrl      = json.data!.image_url

      // Show CDN image immediately
      setGenerations(prev => prev.map(g =>
        g.localId === localId
          ? { ...g, imageUrl: cdnUrl, imageLoading: false, status: 'done', imageTimeS, totalTimeS }
          : g
      ))
      setGenerationCount(prev => prev + 1)
      setTimeout(() => textareaRef.current?.focus(), 150)

    } catch {
      setGenerations(prev => prev.map(g =>
        g.localId === localId ? { ...g, imageLoading: false, imageFailed: true, status: 'done' } : g
      ))
    }
  }

  // Core generation logic — shared by handleSend and retry
  async function executeGeneration(message: string, platform: string, localId: string) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { router.replace('/login'); return }
    const freshToken = session.access_token
    setToken(freshToken)

    const generationStart = Date.now()
    setSending(true)

    // Reset card to thinking state (handles both new card and retry)
    setGenerations(prev => prev.map(g =>
      g.localId === localId
        ? { ...g, status: 'thinking', caption: '', hashtags: [], imageLoading: false, imageUrl: null, imageFailed: false, noReferenceImage: false, captionTimeS: null, imageTimeS: null, totalTimeS: null }
        : g
    ))

    const captionStart = Date.now()
    try {
      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({
          character_id: character!.id,
          message,
          platform,
          correlation_id: localId,
          attachments: attachments.map(a => ({ type: a.type, public_url: a.public_url, label: a.label })),
        }),
      })

      if (res.status === 401) { router.replace('/login'); return }

      const json = await res.json() as {
        data?: { caption: string; image_description: string; hashtags: string[]; generation_id: string | null }
        error?: string
        code?: string
      }

      if (res.status === 429 || json.code === 'CAPTION_LIMIT_REACHED') {
        setCaptionLimitHit(true)
        setGenerations(prev => prev.filter(g => g.localId !== localId))
        return
      }

      if (!res.ok) throw new Error(json.error ?? 'Chat failed')

      const { caption, image_description, hashtags } = json.data!
      const captionTimeS = ((Date.now() - captionStart) / 1000).toFixed(1)

      setGenerations(prev => prev.map(g =>
        g.localId === localId
          ? { ...g, caption, hashtags: hashtags ?? [], imageDescription: image_description, imageLoading: true, status: 'caption_ready', captionTimeS }
          : g
      ))

      // Await image generation — sending stays true until both caption and image complete
      await startImageGeneration(localId, character!.id, image_description, message, platform, localId, freshToken, generationStart)

    } catch {
      setGenerations(prev => prev.map(g =>
        g.localId === localId ? { ...g, status: 'error' } : g
      ))
    } finally {
      setSending(false)
    }
  }

  async function handleSend() {
    if (!input.trim() || sending || !character) return

    const platform      = activePlatform ?? 'general'
    const message       = input.trim()
    const correlationId = crypto.randomUUID()
    setInput('')

    // Push the thinking card — correlationId is its stable key
    setGenerations(prev => [...prev, {
      localId: correlationId, platform, message,
      caption: '', hashtags: [], imageDescription: '',
      imageUrl: null, imageLoading: false, imageFailed: false, noReferenceImage: false,
      generationId: null, status: 'thinking',
      captionTimeS: null, imageTimeS: null, totalTimeS: null,
    }])

    await executeGeneration(message, platform, correlationId)
    setAttachments([])
  }

  async function handleAttachmentFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    setPickerLoading(true)
    setShowAttachmentPicker(false)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch(`${WORKER_URL}/api/upload/attachment`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })
      const responseText = await res.text()
      if (!res.ok) {
        const errMsg = res.status === 400
          ? 'Invalid file type. Use JPEG, PNG, or WebP.'
          : 'Upload failed. Please try again.'
        setAttachmentError(errMsg)
        setTimeout(() => setAttachmentError(null), 3000)
        return
      }

      const json = JSON.parse(responseText) as { id?: string; public_url?: string }
      if (!json.id || !json.public_url) return

      const previewUrl = URL.createObjectURL(file)
      const attachmentType: AttachmentType = 'reference_image'

      const attachment: Attachment = {
        id: json.id,
        type: attachmentType,
        label: pendingProductName || file.name.replace(/\.[^.]+$/, '').slice(0, 30),
        public_url: `${WORKER_URL}${json.public_url}`,
        preview_url: previewUrl,
        source: 'fresh_upload',
      }

      setAttachments(prev => {
        const filtered = prev.filter(a => a.type !== attachmentType)
        return [...filtered, attachment]
      })
      setAttachmentError(null)
      setPendingProductName('')
      setPickerProductName('')
    } catch {
      setAttachmentError('Upload failed. Please try again.')
      setTimeout(() => setAttachmentError(null), 3000)
    }
    finally { setPickerLoading(false) }
  }

  function handleSelectProduct(product: SavedProduct) {
    const url = product.public_url ?? `${WORKER_URL}/files/${product.image_url}`
    const attachment: Attachment = {
      id: product.id,
      type: 'product_image',
      label: product.name,
      public_url: url,
      preview_url: url,
      source: 'library',
    }
    setAttachments(prev => {
      const filtered = prev.filter(a => a.type !== 'product_image')
      return [...filtered, attachment]
    })
    setShowAttachmentPicker(false)
  }

  // Resolve avatar URL
  let avatarUrl: string | null = null
  if (character?.reference_images_ready === 1 && character.reference_image_urls && !avatarError) {
    try {
      const refs: ReferenceImage[] = JSON.parse(character.reference_image_urls)
      const primary = refs.find(r => r.is_primary) ?? refs[0]
      if (primary?.url) avatarUrl = `${WORKER_URL}/files/${primary.url}`
    } catch { /* fall through */ }
  }

  // ── Loading shell ────────────────────────────────────────────────────────
  if (charLoading) {
    return (
      <div className="flex h-screen flex-col bg-[#0a0a0a]">
        {/* Skeleton header */}
        <header className="flex-shrink-0 bg-[#0a0a0a]">
          <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3 sm:px-6 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-[#262626]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-[#262626]" />
              <div className="h-3 w-24 rounded bg-[#1f1f1f]" />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-4 sm:px-6">
            {[0, 1, 2].map(i => <HistoryCardSkeleton key={i} />)}
          </div>
        </main>
      </div>
    )
  }

  if (!character) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="space-y-3 text-center">
          <p className="text-sm text-[#a1a1aa]">Character not found.</p>
          <Link href="/dashboard">
            <Button variant="outline" size="sm" className="bg-black text-white border-white hover:bg-zinc-900 hover:text-white hover:border-white">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const noRefImage = character.reference_images_ready !== 1
  const hasContent = historyLoading || historyGens.length > 0 || generations.length > 0
  const intentShortcuts = getIntentShortcuts(character.domain ?? '', character.character_type)

  // Resolve profile image URL (no avatarError guard — show in panel even if header img failed)
  let profileImageUrl: string | null = null
  if (character.reference_images_ready === 1 && character.reference_image_urls) {
    try {
      const profileRefs: ReferenceImage[] = JSON.parse(character.reference_image_urls)
      const profilePrimary = profileRefs.find(r => r.is_primary) ?? profileRefs[0]
      if (profilePrimary?.url) profileImageUrl = `${WORKER_URL}/files/${profilePrimary.url}`
    } catch { /* fall through */ }
  }

  // Build history render list with date dividers
  type RenderItem =
    | { kind: 'date'; label: string; key: string }
    | { kind: 'gen';  gen: ActiveGeneration }

  const historyRenderList: RenderItem[] = []
  let lastDateLabel = ''
  for (const gen of historyGens) {
    if (!gen.caption && !gen.imageUrl) continue  // skip empty cards
    if (gen.createdAt) {
      const label = getDateLabel(gen.createdAt)
      if (label !== lastDateLabel) {
        historyRenderList.push({ kind: 'date', label, key: `date-${label}` })
        lastDateLabel = label
      }
    }
    historyRenderList.push({ kind: 'gen', gen })
  }

  return (
    <div className="flex h-screen flex-col bg-[#0a0a0a]">

      {/* ── Header ── */}
      <header className="flex-shrink-0 bg-[#0a0a0a]">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="shrink-0 text-lg text-[#71717a] transition-colors hover:text-white"
              aria-label="Back"
            >←</button>

            <button
              type="button"
              onClick={() => setShowProfile(true)}
              className="flex items-center gap-2 min-w-0 flex-1 hover:opacity-80 transition-opacity text-left"
            >
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={avatarUrl}
                  alt={character.name}
                  onError={() => setAvatarError(true)}
                  className="h-8 w-8 shrink-0 rounded-full object-cover sm:h-9 sm:w-9"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-700 to-purple-700 sm:h-9 sm:w-9">
                  <span className="text-xs font-bold text-white">{getInitials(character.name)}</span>
                </div>
              )}

              <div className="min-w-0">
                <h1 className="truncate text-sm font-semibold text-white sm:text-base">{character.name}</h1>
                <p className="truncate text-xs text-[#71717a]">
                  {character.domain}
                  {generationCount > 0 && (
                    <span className="ml-2 text-[#3a3a3a]">· {generationCount} post{generationCount !== 1 ? 's' : ''}</span>
                  )}
                </p>
              </div>
            </button>
          </div>

          <div className="relative shrink-0" ref={menuRef}>
            <button
              onClick={() => setMenuOpen(v => !v)}
              className="p-2 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#262626] transition-colors"
              aria-label="More options"
            >
              <MoreVertical size={18} />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 min-w-[160px] rounded-lg border border-[#262626] bg-[#1a1a1a] shadow-lg z-50">
                <button
                  onClick={() => { router.push(`/dashboard/library?id=${character.id}`); setMenuOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-t-lg px-4 py-2.5 text-left text-sm text-[#a1a1aa] hover:bg-[#262626] hover:text-white"
                >
                  📚 Library
                </button>
                <button
                  onClick={() => { router.push(`/dashboard/settings?id=${character.id}`); setMenuOpen(false) }}
                  className="flex w-full items-center gap-3 rounded-b-lg px-4 py-2.5 text-left text-sm text-[#a1a1aa] hover:bg-[#262626] hover:text-white"
                >
                  ⚙️ Edit character
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── No reference image banner ── */}
      {noRefImage && (
        <div className="flex-shrink-0 border-b border-yellow-900/40 bg-yellow-950/20">
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
            <span className="text-xs text-yellow-400">For consistent images, add a reference photo.</span>
            <Link
              href={`/dashboard/settings?id=${character.id}`}
              className="shrink-0 text-xs font-medium text-yellow-300 underline hover:text-yellow-100"
            >Add Photo</Link>
          </div>
        </div>
      )}

      {/* ── Scrollable chat area ── */}
      <main ref={scrollRef} className="flex-1 overflow-y-auto chat-scrollbar">
        <div className="mx-auto w-full max-w-5xl px-4 py-4 sm:px-6">
          {!hasContent ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <p className="text-sm text-[#71717a]">Ask {character.name} to create content →</p>
            </div>
          ) : (
            <div className="space-y-4">

              {/* History loading skeletons */}
              {historyLoading && [0, 1, 2].map(i => <HistoryCardSkeleton key={i} />)}

              {/* History with date dividers */}
              {!historyLoading && historyRenderList.map(item => {
                if (item.kind === 'date') {
                  return (
                    <div key={item.key} className="flex items-center gap-3 py-1">
                      <div className="flex-1 border-t border-[#1a1a1a]" />
                      <span className="text-[10px] uppercase tracking-widest text-[#71717a]">{item.label}</span>
                      <div className="flex-1 border-t border-[#1a1a1a]" />
                    </div>
                  )
                }
                return (
                  <div key={item.gen.localId} className="opacity-70">
                    <GenerationCard
                      gen={item.gen}
                      mode="history"
                      characterName={character.name}
                      characterId={character.id}
                      token={token}
                      sending={sending}
                      onUpdate={(patch) =>
                        setHistoryGens(prev =>
                          prev.map(g => g.localId === item.gen.localId ? { ...g, ...patch } : g)
                        )
                      }
                      onSendingChange={setSending}
                      onImageClick={(img) => setLightbox({ images: [img], index: 0 })}
                      onImagePanelClick={(g) => setModalGeneration(g)}
                    />
                  </div>
                )
              })}

              {/* Divider between history and live session */}
              {!historyLoading && historyGens.length > 0 && generations.length > 0 && (
                <div className="flex items-center gap-3 py-1">
                  <div className="flex-1 border-t border-[#1e1e1e]" />
                  <span className="text-[10px] uppercase tracking-widest text-[#3a3a3a]">New</span>
                  <div className="flex-1 border-t border-[#1e1e1e]" />
                </div>
              )}

              {/* Live generations */}
              {generations.map(gen => (
                <GenerationCard
                  key={gen.localId}
                  gen={gen}
                  mode="live"
                  characterName={character.name}
                  characterId={character.id}
                  token={token}
                  sending={sending}
                  onUpdate={(patch) =>
                    setGenerations(prev =>
                      prev.map(g => g.localId === gen.localId ? { ...g, ...patch } : g)
                    )
                  }
                  onSendingChange={setSending}
                  onImageClick={(img) => setLightbox({ images: [img], index: 0 })}
                  onImagePanelClick={(g) => setModalGeneration(g)}
                  onRetry={() => executeGeneration(gen.message, gen.platform, gen.localId)}
                />
              ))}

            </div>
          )}
        </div>
      </main>

      {/* ── Bottom input section ── */}
      <div className="sticky bottom-0 bg-[#0a0a0a] border-t border-zinc-800 z-10">

      {captionLimitHit && (
        <div className="mx-4 mb-3 rounded-xl border border-amber-500/30
                        bg-amber-500/10 p-4">
          {!feedbackSubmitted ? (
            <>
              <div className="flex items-start gap-3">
                <span className="text-xl">⚡</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-300">
                    Daily caption limit reached (20/20)
                  </p>
                  <p className="text-xs text-amber-400/70 mt-0.5">
                    Resets at midnight UTC. Want 5 more right now?
                  </p>
                </div>
              </div>

              {!showFeedbackForm ? (
                <button
                  onClick={() => setShowFeedbackForm(true)}
                  className="mt-3 w-full rounded-lg bg-amber-500/20
                             border border-amber-500/40 text-amber-300
                             text-sm py-2 hover:bg-amber-500/30
                             transition-colors">
                  Request 5 more generations →
                </button>
              ) : (
                <div className="mt-3 space-y-2">
                  <textarea
                    value={feedbackText}
                    onChange={e => setFeedbackText(e.target.value)}
                    placeholder="What would you like to create? Your feedback helps us improve PersonalityOS."
                    rows={3}
                    className="w-full rounded-lg bg-zinc-900 border
                               border-zinc-700 text-sm text-white
                               placeholder:text-zinc-500 p-3
                               focus:outline-none focus:border-amber-500/50
                               resize-none" />
                  <button
                    disabled={feedbackSubmitting || !feedbackText.trim()}
                    onClick={async () => {
                      setFeedbackSubmitting(true)
                      try {
                        const { data: { session } } =
                          await supabase.auth.getSession()
                        await fetch(
                          `${WORKER_URL}/api/feedback/request-more`,
                          {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              Authorization: `Bearer ${session?.access_token}`
                            },
                            body: JSON.stringify({ feedback: feedbackText })
                          }
                        )
                        setFeedbackSubmitted(true)
                        setTimeout(() => setCaptionLimitHit(false), 3000)
                      } catch {
                        // silent fail
                      } finally {
                        setFeedbackSubmitting(false)
                      }
                    }}
                    className="w-full rounded-lg bg-amber-500 text-black
                               font-medium text-sm py-2
                               hover:bg-amber-400 transition-colors
                               disabled:opacity-40 disabled:cursor-not-allowed">
                    {feedbackSubmitting ? 'Submitting...' : 'Submit & get 5 more'}
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-3">
              <span className="text-xl">✅</span>
              <div>
                <p className="text-sm font-medium text-green-300">
                  5 extra generations added!
                </p>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Thank you for your feedback.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Intent shortcuts / Offer pills ── */}
      <div>
        <div className="mx-auto w-full max-w-5xl px-4 pt-2 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
            {intentShortcuts.map(intent => (
              <button key={intent}
                disabled={sending}
                onClick={() => {
                  const newIntent = intentPrefix === intent ? '' : intent
                  setIntentPrefix(newIntent)
                  const newInput = buildInput(newIntent, platformPrefix)
                  setInput(newInput)
                  setTimeout(() => {
                    const ta = textareaRef.current
                    if (ta) {
                      ta.focus()
                      const len = ta.value.length
                      ta.setSelectionRange(len, len)
                    }
                  }, 0)
                }}
                className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-medium border transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${sending ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''} ${
                  intentPrefix === intent
                    ? 'bg-zinc-600 text-white border-zinc-500'
                    : 'bg-zinc-800 text-zinc-300 border-zinc-700 hover:bg-zinc-700 hover:text-white'
                }`}>
                {intent}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Platform shortcuts ── */}
      <div>
        <div className="mx-auto w-full max-w-5xl px-4 py-2 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-nowrap">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => selectPlatform(p.id)}
                disabled={sending}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none ${sending ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''} ${
                  activePlatform === p.id
                    ? `${PLATFORM_SHORTCUT[p.id]} bg-zinc-800`
                    : PLATFORM_SHORTCUT[p.id]
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Input area ── */}
      <div>
        <div className="mx-auto w-full max-w-5xl px-4 py-3 sm:px-6">

          {/* Attachment chips */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {attachments.map(att => (
                <div key={att.id} className="flex items-center gap-1.5 rounded-lg border border-[#262626] bg-[#1a1a1a] pl-1 pr-2 py-1">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={att.preview_url} alt={att.label} className="h-6 w-6 rounded object-cover" />
                  <span className="text-xs text-[#a1a1aa] max-w-[100px] truncate">{att.label}</span>
                  <button
                    type="button"
                    onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                    className="text-[#71717a] hover:text-white ml-0.5"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
          {attachmentError && (
            <p className="text-xs text-red-400 mt-1">{attachmentError}</p>
          )}

          <div className="flex items-end gap-2 sm:gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={character.name} className="mb-0.5 h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-700 to-purple-700">
                <span className="text-[10px] font-bold text-white">{getInitials(character.name)}</span>
              </div>
            )}

            {/* Attachment picker */}
            <div className="relative" ref={attachmentPickerRef}>
              <button
                type="button"
                onClick={() => setShowAttachmentPicker(prev => !prev)}
                disabled={sending || pickerLoading}
                className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[#262626] bg-[#141414] text-[#71717a] hover:text-white hover:border-[#404040] transition-colors disabled:opacity-50"
              >
                <Plus size={14} />
              </button>

              {showAttachmentPicker && (
                <div className="absolute bottom-full left-0 mb-2 bg-[#1a1a1a] border border-[#262626] rounded-xl shadow-xl w-64 z-50 p-3">
                  <p className="text-xs text-[#71717a] mb-2">Add reference</p>
                  <button
                    onClick={() => attachmentFileInputRef.current?.click()}
                    className="w-full text-left text-sm text-[#a1a1aa] hover:text-white px-2 py-2 rounded-lg hover:bg-[#262626] flex items-center gap-2"
                  >
                    📷 Upload reference image
                  </button>
                </div>
              )}
            </div>

            {/* Hidden file input */}
            <input
              ref={attachmentFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleAttachmentFileSelect}
            />

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => {
                const v = e.target.value
                setInput(v)
                if (v === '') {
                  setIntentPrefix('')
                  setPlatformPrefix('')
                  setActivePlatform(null)
                }
              }}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder={`Ask ${character.name} to create content...`}
              rows={1}
              disabled={sending || captionLimitHit}
              className={`chat-scrollbar flex-1 resize-none overflow-y-auto rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white placeholder-[#71717a] outline-none transition-colors focus:border-[#404040] disabled:opacity-50 ${sending ? 'opacity-60 cursor-not-allowed' : ''}`}
            />

            <Button
              onClick={handleSend}
              disabled={!input.trim() || sending || captionLimitHit}
              size="sm"
              className="mb-0.5 shrink-0 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-40"
            >
              {sending ? '…' : 'Send'}
            </Button>
          </div>
          <p className="mt-1.5 text-center text-[10px] text-[#3a3a3a]">
            Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>

      </div>{/* end sticky bottom section */}

      {/* ── Image lightbox ── */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

      {/* ── Character profile panel ── */}
      {showProfile && (
        <>
          <div
            className="fixed inset-0 bg-black/60 z-40"
            onClick={() => setShowProfile(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center">
            <div className="relative w-full max-w-sm bg-[#141414] border border-[#262626] rounded-t-2xl max-h-[85vh] overflow-y-auto mx-auto">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-[#404040]" />
            </div>
            <button
              onClick={() => setShowProfile(false)}
              className="absolute top-4 right-4 p-1 text-[#71717a] hover:text-white"
            >
              <X size={18} />
            </button>
            <div className="px-6 pb-8 pt-2">
              <div className="flex justify-center mb-4">
                {profileImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profileImageUrl}
                    alt={character.name}
                    className="mx-auto block w-48 h-56 rounded-2xl object-cover border-2 border-[#262626]"
                  />
                ) : (
                  <div className="mx-auto w-48 h-56 rounded-2xl bg-indigo-600 flex items-center justify-center border-2 border-[#262626]">
                    <span className="text-2xl font-bold text-white">{getInitials(character.name)}</span>
                  </div>
                )}
              </div>
              <div className="text-center mb-1">
                <h2 className="text-xl font-semibold text-white">
                  {character.name}
                  {character.character_type === 'educator' && <span className="ml-2">🎓</span>}
                  {character.character_type === 'creator'  && <span className="ml-2">✨</span>}
                </h2>
                <p className="text-sm text-[#a1a1aa] mt-0.5">{character.domain}</p>
              </div>
              <hr className="border-[#262626] my-4" />
              <div className="space-y-3">
                {[
                  { label: 'Style',       value: formatStylePreset(character.style_preset) },
                  { label: 'Gender',      value: capitalize(character.gender)              },
                  { label: 'Age',         value: character.age_range         ?? ''         },
                  { label: 'Nationality', value: character.nationality       ?? ''         },
                ].filter(item => item.value !== '').map(item => (
                  <div key={item.label} className="flex items-center justify-between">
                    <span className="text-sm text-[#71717a]">{item.label}</span>
                    <span className="text-sm text-white">{item.value}</span>
                  </div>
                ))}
              </div>
              <hr className="border-[#262626] my-4" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#71717a]">Member since</span>
                  <span className="text-sm text-white">{formatDate(character.created_at)}</span>
                </div>
              </div>
              <hr className="border-[#262626] my-4" />
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowProfile(false); router.push('/dashboard/settings?id=' + characterId) }}
                  className="flex-1 rounded-lg border border-[#262626] bg-[#1a1a1a] px-4 py-2.5 text-sm text-[#a1a1aa] transition-colors hover:border-[#404040] hover:text-white"
                >
                  ✏️ Edit Character
                </button>
                <button
                  onClick={() => { setShowProfile(false); router.push('/dashboard/library?id=' + characterId) }}
                  className="flex-1 rounded-lg border border-[#262626] bg-[#1a1a1a] px-4 py-2.5 text-sm text-[#a1a1aa] transition-colors hover:border-[#404040] hover:text-white"
                >
                  📚 Library
                </button>
              </div>
            </div>
            </div>{/* end max-w-sm card */}
          </div>
        </>
      )}

      {/* ── Image modal (chat card click) ── */}
      {modalGeneration && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
          onClick={() => setModalGeneration(null)}
        >
          <div
            className="relative bg-black rounded-2xl overflow-hidden"
            style={{ width: '90vw', maxWidth: '560px', height: '85vh' }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => setModalGeneration(null)}
              className="absolute top-3 right-3 z-10 h-8 w-8 rounded-full bg-black/60 border border-white/20 text-white flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>

            <div
              className="relative w-full h-full"
              onClick={() => setModalCaptionExpanded(false)}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={modalGeneration.imageUrl ?? ''}
                alt="Generated"
                className="w-full h-full"
                style={{ objectFit: 'contain', background: '#000' }}
              />

              {modalGeneration.caption && (
                <div
                  className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4 cursor-pointer"
                  style={{ height: modalCaptionExpanded ? '50%' : 'auto' }}
                  onClick={e => {
                    e.stopPropagation()
                    setModalCaptionExpanded(v => !v)
                  }}
                >
                  <p
                    className={`text-sm text-white leading-relaxed ${modalCaptionExpanded ? 'overflow-y-auto' : 'line-clamp-2'}`}
                    style={{
                      maxHeight: modalCaptionExpanded ? 'calc(50vh - 80px)' : undefined,
                      userSelect: 'text',
                    }}
                  >
                    {modalGeneration.caption.split('\n').map((line, i, arr) => (
                      <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                    ))}
                  </p>
                  {!modalCaptionExpanded && (
                    <p className="text-xs text-zinc-400 mt-1">Tap to read more →</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
