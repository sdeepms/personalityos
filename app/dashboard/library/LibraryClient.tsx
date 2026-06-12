'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Info, X, Download, Copy, Check, Loader2, FolderOpen,
  MessageCircle, Settings, ChevronLeft, ChevronRight, ImageOff,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

const OVERLAY_GRADIENT =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.75) 40%, rgba(0,0,0,0.92) 100%)'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Generation = {
  id: string
  character_id: string
  generation_type: 'text' | 'image'
  platform: string | null
  user_prompt: string
  text_output: string | null
  image_url: string | null
  correlation_id: string | null
  created_at: string
  status: string
}

type GenerationGroup = {
  correlation_id: string | null
  caption: Generation | null
  images: Generation[]
  created_at: string
}

type LibraryMeta = { total: number; page: number; has_more: boolean }

type Character = {
  id: string
  name: string
  domain: string
  reference_image_urls: string
}

type ReferenceImage = { url: string; pose_type: string; is_primary: boolean }

// ─── Constants ─────────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  instagram: 'bg-gradient-to-r from-pink-600 to-purple-600 text-white',
  linkedin:  'bg-blue-600 text-white',
  x:         'bg-zinc-800 border border-zinc-600 text-white',
  carousel:  'bg-orange-600 text-white',
  story:     'bg-green-600 text-white',
  general:   'bg-zinc-700 text-white',
}

const PLATFORM_ASPECT: Record<string, string> = {
  instagram: 'aspect-[1/1]',
  linkedin:  'aspect-[4/5]',
  x:         'aspect-[16/9]',
  story:     'aspect-[9/16]',
  carousel:  'aspect-[1/1]',
  general:   'aspect-[1/1]',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function formatRelativeDate(dateString: string): string {
  const date     = new Date(dateString)
  const now      = new Date()
  const diffMs   = now.getTime() - date.getTime()
  const diffMin  = Math.floor(diffMs / 60_000)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay  = Math.floor(diffHour / 24)

  if (diffMs < 60_000) return 'just now'
  if (diffMin < 60)    return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`
  if (diffHour < 24)   return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`
  if (diffDay < 7)     return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`

  const sameYear = date.getFullYear() === now.getFullYear()
  return sameYear
    ? date.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
    : date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

function formatFullDate(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  })
}

function groupGenerations(gens: Generation[]): GenerationGroup[] {
  const correlated = new Map<string, GenerationGroup>()
  const singletons: GenerationGroup[] = []

  for (const gen of gens) {
    if (gen.correlation_id) {
      if (!correlated.has(gen.correlation_id)) {
        correlated.set(gen.correlation_id, {
          correlation_id: gen.correlation_id,
          caption: null, images: [],
          created_at: gen.created_at,
        })
      }
      const g = correlated.get(gen.correlation_id)!
      if (gen.generation_type === 'text') g.caption = gen
      else g.images.push(gen)
    } else {
      singletons.push({
        correlation_id: null,
        caption: gen.generation_type === 'text' ? gen : null,
        images:  gen.generation_type === 'image' ? [gen] : [],
        created_at: gen.created_at,
      })
    }
  }

  for (const g of correlated.values()) {
    g.images.sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
  }

  const all = [...correlated.values(), ...singletons]
  all.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  return all
}

function parseHashtags(text: string | null): string[] {
  if (!text) return []
  return text.match(/#\w+/g) ?? []
}

function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Shared UI atoms ───────────────────────────────────────────────────────────

function PlatformBadge({ platform }: { platform: string | null }) {
  const p   = platform ?? 'general'
  const cls = PLATFORM_COLORS[p] ?? PLATFORM_COLORS.general
  return (
    <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {p.charAt(0).toUpperCase() + p.slice(1)}
    </span>
  )
}

// Fallback shown when an image URL 404s / expires
function ExpiredImage({ aspectClass }: { aspectClass?: string }) {
  return (
    <div className={`flex w-full flex-col items-center justify-center gap-2 bg-[#1a1a1a] ${aspectClass ?? 'aspect-[4/3]'}`}>
      <ImageOff size={22} className="text-zinc-600" />
      <span className="text-xs text-zinc-500">Image expired</span>
    </div>
  )
}

// Standard (dark-card) action buttons
function CopyBtn({ text, fullWidth }: { text: string; fullWidth?: boolean }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* ignore */ }
  }
  return (
    <Button size="sm" variant="outline" onClick={copy}
      className={`border-[#262626] text-[#a1a1aa] hover:text-white text-xs gap-1.5 ${fullWidth ? 'w-full' : 'flex-1'}`}>
      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
      {copied ? 'Copied!' : 'Copy caption'}
    </Button>
  )
}

function DownloadBtn({ imageUrl, fullWidth }: { imageUrl: string; fullWidth?: boolean }) {
  async function dl() {
    try {
      const blob = await (await fetch(imageUrl)).blob()
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), { href: url, download: `personalityos-${Date.now()}.png` })
      a.click(); URL.revokeObjectURL(url)
    } catch { window.open(imageUrl, '_blank') }
  }
  return (
    <Button size="sm" variant="outline" onClick={dl}
      className={`border-[#262626] text-[#a1a1aa] hover:text-white text-xs gap-1.5 ${fullWidth ? 'w-full' : 'flex-1'}`}>
      <Download size={12} /> Download
    </Button>
  )
}

// Translucent buttons used on top of images (overlay style)
function OverlayCopy({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  async function copy(e: React.MouseEvent) {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    catch { /* ignore */ }
  }
  return (
    <button onClick={copy}
      className="flex h-7 flex-1 items-center justify-center gap-1 rounded border border-white/20 bg-black/50 text-xs text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white">
      {copied ? <Check size={11} className="text-green-400" /> : <Copy size={11} />}
      {copied ? 'Copied!' : 'Copy caption'}
    </button>
  )
}

function OverlayDownload({ imageUrl }: { imageUrl: string }) {
  async function dl(e: React.MouseEvent) {
    e.stopPropagation()
    try {
      const blob = await (await fetch(imageUrl)).blob()
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), { href: url, download: `personalityos-${Date.now()}.png` })
      a.click(); URL.revokeObjectURL(url)
    } catch { window.open(imageUrl, '_blank') }
  }
  return (
    <button onClick={dl}
      className="flex h-7 flex-1 items-center justify-center gap-1 rounded border border-white/20 bg-black/50 text-xs text-white/80 backdrop-blur-sm transition-colors hover:bg-black/70 hover:text-white">
      <Download size={11} /> Download
    </button>
  )
}

// ─── Card skeletons ────────────────────────────────────────────────────────────

function CardSkeletonGrid() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[#262626] bg-[#1a1a1a]">
          <Skeleton className="absolute inset-0 rounded-none bg-[#262626]" />
          <div className="absolute bottom-0 left-0 right-0 space-y-2 p-3"
            style={{ background: OVERLAY_GRADIENT }}>
            <div className="flex justify-between gap-2">
              <Skeleton className="h-4 w-16 rounded-full bg-[#444]" />
              <Skeleton className="h-3 w-10 rounded bg-[#444]" />
            </div>
            <Skeleton className="h-3 w-full rounded bg-[#444]" />
            <div className="flex gap-1.5">
              <Skeleton className="h-6 flex-1 rounded bg-[#444]" />
              <Skeleton className="h-6 flex-1 rounded bg-[#444]" />
            </div>
          </div>
        </div>
      ))}
    </>
  )
}

// ─── Image card (overlay design, carousel support) ────────────────────────────

function ImageCard({ group, onClick }: { group: GenerationGroup; onClick: () => void }) {
  const [activeIndex,   setActiveIndex]   = useState(0)
  const [failedImages,  setFailedImages]  = useState<Set<number>>(new Set())

  const platform     = group.caption?.platform ?? group.images[0]?.platform ?? null
  const caption      = group.caption?.text_output ?? ''
  const aspectClass  = PLATFORM_ASPECT[platform ?? ''] ?? 'aspect-[4/3]'
  const current      = group.images[activeIndex]
  const currentFailed = failedImages.has(activeIndex)
  const multi        = group.images.length > 1

  function markFailed(idx: number) {
    return (e: React.SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.style.display = 'none'
      setFailedImages(prev => new Set([...prev, idx]))
    }
  }

  return (
    <div
      className="relative overflow-hidden rounded-lg border border-[#262626] cursor-pointer transition-colors hover:border-[#404040]"
      onClick={onClick}
    >
      {/* Image */}
      {currentFailed || !current?.image_url ? (
        <ExpiredImage aspectClass={aspectClass} />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={current.image_url}
          alt="Generated"
          className={`w-full object-cover ${aspectClass}`}
          onError={markFailed(activeIndex)}
        />
      )}

      {/* Carousel arrows */}
      {multi && activeIndex > 0 && (
        <button
          className="absolute left-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          onClick={e => { e.stopPropagation(); setActiveIndex(i => i - 1) }}
          aria-label="Previous image"
        >
          <ChevronLeft size={14} />
        </button>
      )}
      {multi && activeIndex < group.images.length - 1 && (
        <button
          className="absolute right-2 top-1/2 z-20 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          onClick={e => { e.stopPropagation(); setActiveIndex(i => i + 1) }}
          aria-label="Next image"
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Dot indicators */}
      {multi && (
        <div className="absolute left-0 right-0 top-2 z-20 flex justify-center gap-1">
          {group.images.map((_, i) => (
            <button
              key={i}
              onClick={e => { e.stopPropagation(); setActiveIndex(i) }}
              className={`h-1.5 w-1.5 rounded-full transition-colors ${i === activeIndex ? 'bg-white' : 'bg-white/40'}`}
              aria-label={`Image ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Gradient overlay */}
      <div className="absolute bottom-0 left-0 right-0 z-10 p-3" style={{ background: OVERLAY_GRADIENT }}>
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <PlatformBadge platform={platform} />
          <span className="shrink-0 text-xs text-zinc-400">{formatRelativeDate(group.created_at)}</span>
        </div>
        {caption && (
          <p className="mb-2 line-clamp-2 text-sm leading-snug text-white">{caption}</p>
        )}
        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
          {current?.image_url && !currentFailed && <OverlayDownload imageUrl={current.image_url} />}
          {caption && <OverlayCopy text={caption} />}
        </div>
      </div>
    </div>
  )
}

// ─── Caption-only card ─────────────────────────────────────────────────────────

function CaptionCard({ group, onClick }: { group: GenerationGroup; onClick: () => void }) {
  const caption = group.caption?.text_output ?? ''
  const preview = caption.slice(0, 150) + (caption.length > 150 ? '…' : '')

  return (
    <Card
      className="gap-0 p-0 ring-0 border-[#262626] bg-[#141414] overflow-hidden cursor-pointer hover:border-[#404040] transition-colors"
      onClick={onClick}
    >
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <PlatformBadge platform={group.caption?.platform ?? null} />
          <span className="shrink-0 text-xs text-[#71717a]">{formatRelativeDate(group.created_at)}</span>
        </div>
        <p className="line-clamp-3 text-sm leading-relaxed text-[#a1a1aa]">{preview || 'No caption'}</p>
        <div onClick={e => e.stopPropagation()}>
          <CopyBtn text={caption} fullWidth />
        </div>
      </div>
    </Card>
  )
}

// ─── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ characterId }: { characterId: string }) {
  return (
    <div className="flex min-h-[400px] items-center justify-center">
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#262626] bg-[#141414]">
            <FolderOpen size={28} className="text-[#71717a]" />
          </div>
        </div>
        <h3 className="text-base font-semibold text-white">No content yet</h3>
        <p className="mx-auto max-w-xs text-sm text-[#71717a]">Go to Chat Studio to create your first post</p>
        <Link href={`/dashboard/chat?id=${characterId}`}>
          <Button className="mt-2 bg-indigo-600 text-white hover:bg-indigo-500">Open Chat Studio</Button>
        </Link>
      </div>
    </div>
  )
}

// ─── Modal ─────────────────────────────────────────────────────────────────────

function LibraryModal({ group, onClose }: { group: GenerationGroup; onClose: () => void }) {
  const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'unknown'>('unknown')
  const [activeIndex,  setActiveIndex]  = useState(0)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())

  const caption  = group.caption?.text_output ?? ''
  const hashtags = parseHashtags(caption)
  const platform = group.caption?.platform ?? group.images[0]?.platform ?? null
  const hasImgs  = group.images.length > 0
  const multi    = group.images.length > 1
  const current  = group.images[activeIndex]
  const curFailed = failedImages.has(activeIndex)
  const hasCurrentImg = hasImgs && !!current?.image_url && !curFailed

  function markFailed(idx: number) {
    return (e: React.SyntheticEvent<HTMLImageElement>) => {
      e.currentTarget.style.display = 'none'
      setFailedImages(prev => new Set([...prev, idx]))
    }
  }

  function detectOrientation(e: React.SyntheticEvent<HTMLImageElement>) {
    const img = e.currentTarget
    setOrientation(img.naturalHeight > img.naturalWidth ? 'portrait' : 'landscape')
  }

  const goPrev = () => setActiveIndex(i => Math.max(0, i - 1))
  const goNext = () => setActiveIndex(i => Math.min(group.images.length - 1, i + 1))

  // Portrait → narrow modal; landscape or no-image → wide modal
  const isPortrait  = orientation === 'portrait'
  const isLandscape = orientation === 'landscape' || !hasImgs
  const maxW = isPortrait ? 'max-w-[480px]' : isLandscape ? 'max-w-[800px]' : 'max-w-[600px]'

  // Shared image section JSX (inlined to avoid nested-component pattern)
  const imageSection = (withOverlay: boolean) => (
    <div className="relative flex items-center justify-center overflow-hidden bg-[#0a0a0a]">
      {!hasImgs ? null : curFailed || !current?.image_url ? (
        <div className="flex min-h-[200px] w-full items-center justify-center">
          <ExpiredImage />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={current.id}
          src={current.image_url}
          alt="Generated"
          className="w-full object-contain"
          style={{ maxHeight: '70vh' }}
          onError={markFailed(activeIndex)}
        />
      )}

      {/* Carousel arrows */}
      {multi && activeIndex > 0 && (
        <button onClick={goPrev} aria-label="Previous"
          className="absolute left-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
          <ChevronLeft size={16} />
        </button>
      )}
      {multi && activeIndex < group.images.length - 1 && (
        <button onClick={goNext} aria-label="Next"
          className="absolute right-2 top-1/2 z-20 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80">
          <ChevronRight size={16} />
        </button>
      )}

      {/* Counter */}
      {multi && (
        <div className="absolute right-3 top-3 z-20 rounded bg-black/60 px-2 py-0.5 text-xs text-white/80">
          {activeIndex + 1} / {group.images.length}
        </div>
      )}

      {/* Gradient overlay (portrait only) */}
      {withOverlay && (
        <div className="absolute bottom-0 left-0 right-0 z-10 p-3" style={{ background: OVERLAY_GRADIENT }}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <PlatformBadge platform={platform} />
            <span className="text-xs text-zinc-400">{formatRelativeDate(group.created_at)}</span>
          </div>
          {caption && <p className="line-clamp-2 text-sm leading-snug text-white">{caption}</p>}
        </div>
      )}
    </div>
  )

  return (
    <Dialog open onOpenChange={open => { if (!open) onClose() }}>
      <DialogContent
        showCloseButton={false}
        className={`w-full p-0 ring-0 border-[#262626] bg-[#141414] overflow-hidden ${maxW}`}
      >
        <DialogTitle className="sr-only">Generation detail</DialogTitle>

        {/* Close button */}
        <button onClick={onClose} aria-label="Close"
          className="absolute right-3 top-3 z-30 flex h-8 w-8 items-center justify-center rounded-full text-[#71717a] transition-colors hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>

        {/* Hidden img for orientation detection (fires before layout renders) */}
        {orientation === 'unknown' && hasImgs && current?.image_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={current.image_url}
            alt=""
            className="pointer-events-none absolute -left-full -top-full h-0 w-0 opacity-0"
            onLoad={detectOrientation}
            onError={() => setOrientation('landscape')}
          />
        )}

        {/* Skeleton while detecting */}
        {orientation === 'unknown' && hasImgs ? (
          <div>
            <Skeleton className="h-64 w-full rounded-none bg-[#1e1e1e]" />
            <div className="space-y-3 p-5">
              <Skeleton className="h-5 w-32 rounded-full bg-[#1e1e1e]" />
              <Skeleton className="h-4 w-full rounded bg-[#1e1e1e]" />
              <Skeleton className="h-4 w-4/5 rounded bg-[#1e1e1e]" />
            </div>
          </div>

        ) : isPortrait ? (
          /* ── Portrait layout ── */
          <div className="flex max-h-[90vh] flex-col overflow-y-auto">
            {imageSection(true)}

            {caption && (
              <div
                className="max-h-[200px] overflow-y-auto border-t border-[#262626] px-4 py-3"
                style={{ userSelect: 'text', cursor: 'text' }}
              >
                <p className="text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap">{caption}</p>
              </div>
            )}

            <div className="flex gap-2 border-t border-[#262626] p-4">
              {caption && <CopyBtn text={caption} />}
              {hasCurrentImg && <DownloadBtn imageUrl={current!.image_url!} />}
            </div>
          </div>

        ) : (
          /* ── Landscape / no-image layout ── */
          <div className="flex max-h-[90vh] flex-col lg:flex-row">
            {hasImgs && (
              <div className="lg:w-[60%]">
                {imageSection(false)}
              </div>
            )}

            <div className={`flex flex-col overflow-y-auto border-t border-[#262626] p-5 lg:border-l lg:border-t-0 ${hasImgs ? 'lg:w-[40%]' : 'w-full'}`}>
              <div className="flex flex-wrap items-center gap-3">
                <PlatformBadge platform={platform} />
                <span className="text-xs text-zinc-500">{formatFullDate(group.created_at)}</span>
              </div>

              {caption ? (
                <div
                  className="mt-4 flex-1 overflow-y-auto text-sm leading-relaxed text-zinc-200 whitespace-pre-wrap"
                  style={{ userSelect: 'text', cursor: 'text' }}
                >
                  {caption}
                </div>
              ) : (
                <p className="mt-4 text-sm italic text-zinc-500">No caption for this post</p>
              )}

              {hashtags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {hashtags.map((tag, i) => (
                    <span key={i} className="rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs text-indigo-400">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-col gap-2">
                {caption && <CopyBtn text={caption} fullWidth />}
                {hasCurrentImg && <DownloadBtn imageUrl={current!.image_url!} fullWidth />}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export default function LibraryClient() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const characterId   = searchParams.get('id')

  const [character,     setCharacter]     = useState<Character | null>(null)
  const [generations,   setGenerations]   = useState<Generation[]>([])
  const [meta,          setMeta]          = useState<LibraryMeta>({ total: 0, page: 1, has_more: false })
  const [loading,       setLoading]       = useState(true)
  const [error,         setError]         = useState<string | null>(null)
  const [filter,        setFilter]        = useState<'all' | 'images' | 'captions'>('all')
  const [selectedGroup, setSelectedGroup] = useState<GenerationGroup | null>(null)
  const [dismissed,     setDismissed]     = useState(false)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const [token,         setToken]         = useState<string | null>(null)
  const [avatarError,   setAvatarError]   = useState(false)

  const fetchLibrary = useCallback(async (jwt: string, page: number, append = false) => {
    const res = await fetch(
      `${WORKER_URL}/api/library?character_id=${characterId}&type=all&page=${page}&limit=20`,
      { headers: { Authorization: `Bearer ${jwt}` } }
    )
    if (res.status === 401) throw new Error('UNAUTH')
    if (!res.ok) throw new Error(`Library fetch failed: ${res.status}`)
    const json = await res.json() as { data: Generation[]; meta: LibraryMeta }
    setGenerations(prev => append ? [...prev, ...json.data] : json.data)
    setMeta(json.meta)
  }, [characterId])

  useEffect(() => {
    if (!characterId) { router.replace('/dashboard'); return }
    const supabase = createClient()

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)
      try {
        const charRes = await fetch(`${WORKER_URL}/api/characters/${characterId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        if (charRes.status === 401) { router.push('/login'); return }
        if (!charRes.ok) { router.replace('/dashboard'); return }
        setCharacter((await charRes.json() as { data: Character }).data)
        await fetchLibrary(session.access_token, 1)
      } catch (err) {
        if ((err as Error).message === 'UNAUTH') { router.push('/login'); return }
        setError('Failed to load library. Please try again.')
        console.error('[LibraryClient] init error:', err)
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [characterId, router, fetchLibrary])

  async function loadMore() {
    if (!token || loadingMore) return
    setLoadingMore(true)
    try { await fetchLibrary(token, meta.page + 1, true) }
    catch { /* silent */ }
    finally { setLoadingMore(false) }
  }

  async function retry() {
    if (!token) return
    setError(null); setLoading(true)
    try { await fetchLibrary(token, 1) }
    catch { setError('Failed to load library. Please try again.') }
    finally { setLoading(false) }
  }

  // Avatar
  let avatarUrl: string | null = null
  if (character && !avatarError) {
    try {
      const refs: ReferenceImage[] = JSON.parse(character.reference_image_urls)
      const primary = refs.find(r => r.is_primary) ?? refs[0]
      if (primary?.url) avatarUrl = `${WORKER_URL}/files/${primary.url}`
    } catch { /* ignore */ }
  }

  const allGroups      = groupGenerations(generations)
  const filteredGroups = filter === 'all'
    ? allGroups
    : filter === 'images'
    ? allGroups.filter(g => g.images.length > 0)
    : allGroups.filter(g => g.caption !== null)

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-[#262626] bg-[#0a0a0a]">
          <div className="mx-auto flex w-full max-w-6xl animate-pulse items-center justify-between gap-3 px-4 py-3 sm:px-6">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-[#262626]" />
              <div className="space-y-1.5">
                <div className="h-4 w-32 rounded bg-[#262626]" />
                <div className="h-3 w-20 rounded bg-[#1f1f1f]" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-7 w-14 rounded bg-[#262626]" />
              <div className="h-7 w-20 rounded bg-[#262626]" />
            </div>
          </div>
        </header>
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
          <div className="mb-6 flex animate-pulse items-center justify-between">
            <div className="h-6 w-20 rounded bg-[#262626]" />
            <div className="h-5 w-16 rounded bg-[#262626]" />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <CardSkeletonGrid />
          </div>
        </div>
      </div>
    )
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="space-y-4 text-center">
          <p className="text-sm text-[#a1a1aa]">{error}</p>
          <Button onClick={retry} className="bg-indigo-600 text-white hover:bg-indigo-500">Try again</Button>
        </div>
      </div>
    )
  }

  if (!character) return null

  return (
    <div className="min-h-screen bg-[#0a0a0a]">

      {/* ── Header ── */}
      <header className="border-b border-[#262626] bg-[#0a0a0a]">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button onClick={() => router.push('/dashboard')} aria-label="Back"
              className="shrink-0 text-lg text-[#71717a] transition-colors hover:text-white">←</button>

            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={character.name} onError={() => setAvatarError(true)}
                className="h-8 w-8 shrink-0 rounded-full object-cover sm:h-9 sm:w-9" />
            ) : (
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-700 to-purple-700 sm:h-9 sm:w-9">
                <span className="text-xs font-bold text-white">{getInitials(character.name)}</span>
              </div>
            )}

            <div className="min-w-0">
              <h1 className="truncate text-sm font-semibold text-white sm:text-base">{character.name}</h1>
              <p className="truncate text-xs text-[#71717a]">{character.domain}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <Link href={`/dashboard/chat?id=${characterId}`}>
              <Button size="sm" variant="outline" className="gap-1.5 border-[#262626] px-2.5 text-xs text-[#a1a1aa] hover:text-white sm:px-3">
                <MessageCircle size={13} /> Chat
              </Button>
            </Link>
            <Link href={`/dashboard/settings?id=${characterId}`}>
              <Button size="sm" variant="outline" className="gap-1.5 border-[#262626] px-2.5 text-xs text-[#a1a1aa] hover:text-white sm:px-3">
                <Settings size={13} /> Settings
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">

        {/* ── Title row ── */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Library</h2>
          <span className="text-sm text-[#71717a]">{meta.total} post{meta.total !== 1 ? 's' : ''}</span>
        </div>

        {/* ── Filter tabs ── (Issue 2) */}
        <Tabs value={filter} onValueChange={v => setFilter(v as 'all' | 'images' | 'captions')} className="mb-4">
          <TabsList
            className="h-9 gap-0 rounded-[8px] border border-[#262626] p-[3px]"
            style={{ background: '#1a1a1a' }}
          >
            {(['all', 'images', 'captions'] as const).map(v => (
              <TabsTrigger
                key={v}
                value={v}
                className="text-xs [&[data-state=active]]:rounded-[6px] [&[data-state=active]]:bg-[#262626] [&[data-state=active]]:text-white [&[data-state=inactive]]:text-[#a1a1aa]"
                style={{ color: filter === v ? '#ffffff' : '#a1a1aa' }}
              >
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* ── 30-day notice ── */}
        {!dismissed && (
          <div className="mb-5 flex items-center gap-3 rounded-lg border border-[#262626] bg-[#1a1a1a] px-4 py-3">
            <Info size={14} className="shrink-0 text-[#71717a]" />
            <span className="flex-1 text-xs text-[#71717a]">
              Images are available for 30 days. Download to save permanently.
            </span>
            <button onClick={() => setDismissed(true)} aria-label="Dismiss"
              className="shrink-0 text-[#71717a] transition-colors hover:text-white">
              <X size={14} />
            </button>
          </div>
        )}

        {/* ── Grid ── */}
        {filteredGroups.length === 0 ? (
          <EmptyState characterId={characterId!} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredGroups.map((group, i) => {
                const key = group.correlation_id ?? `${group.created_at}-${i}`
                return group.images.length > 0
                  ? <ImageCard key={key} group={group} onClick={() => setSelectedGroup(group)} />
                  : <CaptionCard key={key} group={group} onClick={() => setSelectedGroup(group)} />
              })}
            </div>

            {meta.has_more && (
              <div className="mt-8 flex justify-center">
                <Button onClick={loadMore} disabled={loadingMore} variant="outline"
                  className="gap-2 border-[#262626] text-[#a1a1aa] hover:text-white">
                  {loadingMore && <Loader2 size={14} className="animate-spin" />}
                  {loadingMore ? 'Loading…' : 'Load more'}
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Modal ── */}
      {selectedGroup && (
        <LibraryModal group={selectedGroup} onClose={() => setSelectedGroup(null)} />
      )}
    </div>
  )
}
