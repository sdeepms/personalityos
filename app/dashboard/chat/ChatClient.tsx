'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { RefreshCw, Share2, ChevronLeft, ChevronRight, X } from 'lucide-react'
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
  generationId: string | null
  status: 'thinking' | 'caption_ready' | 'done' | 'error'
  createdAt?: string
  captionTimeS: string | null
  imageTimeS: string | null
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
      className="flex h-7 w-7 items-center justify-center rounded-full border border-[#2a2a2a] text-[#71717a] transition-colors hover:border-[#404040] hover:text-white disabled:opacity-40"
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

/**
 * Pairs text + image rows into combined cards.
 * Primary: same correlation_id. Fallback: platform + ≤120s (legacy rows).
 */
function pairHistoryItems(items: HistoryItem[]): ActiveGeneration[] {
  const textGens  = items.filter(i => i.generation_type === 'text')
  const imageGens = items.filter(i => i.generation_type === 'image')
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
      imageUrl:         match?.image_url ?? null,
      imageLoading:     false,
      imageFailed:      false,
      noReferenceImage: false,
      generationId:     t.id,
      status:           'done',
      createdAt:        t.created_at,
      captionTimeS:     null,
      imageTimeS:       null,
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
      imageUrl:         img.image_url ?? null,
      imageLoading:     false,
      imageFailed:      false,
      noReferenceImage: false,
      generationId:     img.id,
      status:           'done',
      createdAt:        img.created_at,
      captionTimeS:     null,
      imageTimeS:       null,
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
  onRetry?: () => void
}) {
  const [copied,              setCopied]              = useState(false)
  const [linkCopied,          setLinkCopied]          = useState(false)
  const [captionRegenerating, setCaptionRegenerating] = useState(false)
  const [imageRegenerating,   setImageRegenerating]   = useState(false)

  const anyBusy = captionRegenerating || imageRegenerating || sending

  async function copyCaption() {
    try {
      await navigator.clipboard.writeText(gen.caption)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
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

  // ── Image panel content ───────────────────────────────────────────────────
  const imagePanelContent = (() => {
    if (gen.imageLoading) return <ImageSkeleton platform={gen.platform} />

    if (gen.imageUrl) return (
      <>
        <div className="overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gen.imageUrl}
            alt="Generated"
            className="w-full cursor-pointer object-cover transition-all duration-200 hover:opacity-90 hover:scale-[1.01]"
            onClick={() => onImageClick?.({
              url:       gen.imageUrl!,
              platform:  gen.platform,
              caption:   gen.caption,
              createdAt: gen.createdAt,
            })}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-[#71717a]">{ASPECT_LABEL[gen.platform] ?? '1:1'}</span>
            {gen.imageTimeS && (
              <span className="text-[10px] text-[#3a3a3a]">Generated in {gen.imageTimeS}s</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <IconBtn onClick={shareImage} title={linkCopied ? 'Link copied!' : 'Share'}>
              {linkCopied
                ? <span className="text-[10px] font-medium text-green-400">✓</span>
                : <Share2 size={13} />
              }
            </IconBtn>
            <IconBtn onClick={regenerateImage} disabled={anyBusy} title="Regenerate image" spinning={imageRegenerating}>
              <RefreshCw size={13} />
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
      </>
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

    if (mode === 'history') return (
      <div className="flex items-center justify-center rounded-lg border border-dashed border-[#1e1e1e] p-8">
        <p className="text-xs text-[#3a3a3a]">Image not available</p>
      </div>
    )

    return null
  })()

  const showImagePanel = mode === 'history' || gen.imageLoading || !!gen.imageUrl || gen.imageFailed || gen.noReferenceImage

  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] overflow-hidden">
      <div className="flex flex-col sm:flex-row">

        {/* LEFT — image (40%) */}
        {showImagePanel && (
          <div className="flex-[2] p-4 flex flex-col gap-2 border-b border-[#262626] sm:border-b-0 sm:border-r">
            {imagePanelContent}
          </div>
        )}

        {/* RIGHT — caption (60%) */}
        <div className="flex-[3] flex flex-col p-4">
          <div className="mb-3">
            <PlatformBadge platform={gen.platform} />
          </div>
          {gen.caption ? (
            <p className="chat-scrollbar flex-1 overflow-y-auto text-sm leading-relaxed text-[#e5e5e5] whitespace-pre-wrap">{gen.caption}</p>
          ) : (
            <p className="flex-1 text-sm italic text-[#3a3a3a]">No caption available.</p>
          )}
          {gen.hashtags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {gen.hashtags.map((tag, i) => (
                <span key={i} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">
                  {tag.startsWith('#') ? tag : `#${tag}`}
                </span>
              ))}
            </div>
          )}
          <div className="mt-3 flex items-center justify-between">
            {gen.captionTimeS
              ? <span className="text-[10px] text-[#3a3a3a]">Generated in {gen.captionTimeS}s</span>
              : <span />
            }
            <div className="flex gap-1.5">
              <IconBtn onClick={copyCaption} title={copied ? 'Copied!' : 'Copy caption'}>
                {copied
                  ? <span className="text-[10px] font-medium text-green-400">✓</span>
                  : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                }
              </IconBtn>
              <IconBtn onClick={regenerateCaption} disabled={anyBusy} title="Regenerate caption" spinning={captionRegenerating}>
                <RefreshCw size={13} />
              </IconBtn>
            </div>
          </div>
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

  const [character,       setCharacter]     = useState<Character | null>(null)
  const [charLoading,     setCharLoading]   = useState(true)
  const [historyGens,     setHistoryGens]   = useState<ActiveGeneration[]>([])
  const [historyLoading,  setHistoryLoading]= useState(true)
  const [generationCount, setGenerationCount] = useState(0)
  const [generations,     setGenerations]   = useState<ActiveGeneration[]>([])
  const [input,           setInput]         = useState('')
  const [activePlatform,  setActivePlatform]= useState<string | null>(null)
  const [sending,         setSending]       = useState(false)
  const [token,           setToken]         = useState<string | null>(null)
  const [avatarError,     setAvatarError]   = useState(false)
  const [lightbox,        setLightbox]      = useState<{ images: LightboxImage[]; index: number } | null>(null)

  const scrollRef   = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

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
    if (generations.length > 0) setTimeout(scrollToBottom, 100)
  }, [generations.length, scrollToBottom])

  // Scroll to bottom after history finishes loading so the most recent post is visible
  useEffect(() => {
    if (!historyLoading) setTimeout(scrollToBottom, 150)
  }, [historyLoading, scrollToBottom])

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
    setActivePlatform(platformId)
    const cfg    = PLATFORMS.find(p => p.id === platformId)
    const prefix = cfg?.prefix ?? `Create a ${platformId} post about: `
    setInput(prefix)
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus()
        textareaRef.current.setSelectionRange(prefix.length, prefix.length)
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

      if (!res.ok) throw new Error(json.error ?? 'Image request failed')

      const imageTimeS = ((Date.now() - start) / 1000).toFixed(1)
      setGenerations(prev => prev.map(g =>
        g.localId === localId
          ? { ...g, imageUrl: json.data!.image_url, imageLoading: false, status: 'done', imageTimeS }
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

    setSending(true)

    // Reset card to thinking state (handles both new card and retry)
    setGenerations(prev => prev.map(g =>
      g.localId === localId
        ? { ...g, status: 'thinking', caption: '', hashtags: [], imageLoading: false, imageUrl: null, imageFailed: false, noReferenceImage: false, captionTimeS: null, imageTimeS: null }
        : g
    ))

    const captionStart = Date.now()
    try {
      const res = await fetch(`${WORKER_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${freshToken}` },
        body: JSON.stringify({ character_id: character!.id, message, platform, correlation_id: localId }),
      })

      if (res.status === 401) { router.replace('/login'); return }

      const json = await res.json() as {
        data?: { caption: string; image_description: string; hashtags: string[]; generation_id: string | null }
        error?: string
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
      await startImageGeneration(localId, character!.id, image_description, message, platform, localId, freshToken)

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
      captionTimeS: null, imageTimeS: null,
    }])

    await executeGeneration(message, platform, correlationId)
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
          <div className="mx-auto flex w-full max-w-4xl items-center gap-3 px-4 py-3 sm:px-6 animate-pulse">
            <div className="h-8 w-8 rounded-full bg-[#262626]" />
            <div className="flex-1 space-y-1.5">
              <div className="h-4 w-32 rounded bg-[#262626]" />
              <div className="h-3 w-24 rounded bg-[#1f1f1f]" />
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-4 sm:px-6">
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
            <Button variant="outline" size="sm" className="border-[#262626] text-[#a1a1aa]">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    )
  }

  const noRefImage = character.reference_images_ready !== 1
  const hasContent = historyLoading || historyGens.length > 0 || generations.length > 0

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
        <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button
              onClick={() => router.push('/dashboard')}
              className="shrink-0 text-lg text-[#71717a] transition-colors hover:text-white"
              aria-label="Back"
            >←</button>

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
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href={`/dashboard/library?id=${character.id}`}>
              <Button size="sm" variant="outline" className="border-[#262626] px-2.5 text-xs text-[#a1a1aa] hover:text-white sm:px-3">Library</Button>
            </Link>
            <Link href={`/dashboard/settings?id=${character.id}`}>
              <Button size="sm" variant="outline" className="border-[#262626] px-2.5 text-xs text-[#a1a1aa] hover:text-white sm:px-3">Settings</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── No reference image banner ── */}
      {noRefImage && (
        <div className="flex-shrink-0 border-b border-yellow-900/40 bg-yellow-950/20">
          <div className="mx-auto flex w-full max-w-4xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
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
        <div className="mx-auto w-full max-w-4xl px-4 py-4 sm:px-6">
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
                  onRetry={() => executeGeneration(gen.message, gen.platform, gen.localId)}
                />
              ))}

            </div>
          )}
        </div>
      </main>

      {/* ── Platform shortcuts ── */}
      <div className="flex-shrink-0 bg-[#0a0a0a]">
        <div className="mx-auto w-full max-w-4xl px-4 py-2 sm:px-6">
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map(p => (
              <button
                key={p.id}
                onClick={() => selectPlatform(p.id)}
                disabled={sending}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors disabled:cursor-not-allowed ${
                  activePlatform === p.id
                    ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300'
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
      <div className="flex-shrink-0 bg-[#0a0a0a]">
        <div className="mx-auto w-full max-w-4xl px-4 py-3 sm:px-6">
          <div className="flex items-end gap-2 sm:gap-3">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={character.name} className="mb-0.5 h-7 w-7 shrink-0 rounded-full object-cover" />
            ) : (
              <div className="mb-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-700 to-purple-700">
                <span className="text-[10px] font-bold text-white">{getInitials(character.name)}</span>
              </div>
            )}

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
              }}
              placeholder={`Ask ${character.name} to create content...`}
              rows={1}
              disabled={sending}
              className="chat-scrollbar flex-1 resize-none overflow-y-auto rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white placeholder-[#71717a] outline-none transition-colors focus:border-[#404040] disabled:opacity-50"
            />

            <Button
              onClick={handleSend}
              disabled={!input.trim() || sending}
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

      {/* ── Image lightbox ── */}
      {lightbox && (
        <ImageLightbox
          images={lightbox.images}
          initialIndex={lightbox.index}
          onClose={() => setLightbox(null)}
        />
      )}

    </div>
  )
}
