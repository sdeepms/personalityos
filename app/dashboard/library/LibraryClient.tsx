'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  X, Download, Copy, Check, Loader2, FolderOpen,
  Search, Settings, ChevronLeft, ChevronRight, ImageOff, SlidersHorizontal,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

const OVERLAY_GRADIENT =
  'linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.5) 30%, rgba(0,0,0,0.85) 70%, rgba(0,0,0,0.95) 100%)'

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
      className={`bg-black text-white border-white hover:bg-zinc-900 hover:text-white hover:border-white text-xs gap-1.5 ${fullWidth ? 'w-full' : 'flex-1'}`}>
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
      className={`bg-black text-white border-white hover:bg-zinc-900 hover:text-white hover:border-white text-xs gap-1.5 ${fullWidth ? 'w-full' : 'flex-1'}`}>
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

function ImageCard({ group, onClick, imageOnly }: { group: GenerationGroup; onClick: () => void; imageOnly?: boolean }) {
  const [activeIndex,  setActiveIndex]  = useState(0)
  const [failedImages, setFailedImages] = useState<Set<number>>(new Set())

  const platform  = group.caption?.platform ?? group.images[0]?.platform ?? null
  const caption   = group.caption?.text_output ?? ''
  const aspectClass = platform === 'story' ? 'aspect-[9/16]' : platform === 'x' ? 'aspect-[16/9]' : 'aspect-[4/3]'
  const current   = group.images[activeIndex]
  const currentFailed = failedImages.has(activeIndex)
  const multi     = group.images.length > 1

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
          <span style={{ textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}>
            <PlatformBadge platform={platform} />
          </span>
          <span className="shrink-0 text-xs font-medium text-white" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
            {formatRelativeDate(group.created_at)}
          </span>
        </div>
        {!imageOnly && caption && (
          <p className="mb-2 line-clamp-2 text-sm leading-snug text-white">
            {caption.split('\n').map((line, i, arr) => (
              <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
            ))}
          </p>
        )}
        <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
          {current?.image_url && !currentFailed && <OverlayDownload imageUrl={current.image_url} />}
          {!imageOnly && caption && <OverlayCopy text={caption} />}
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
        <p className="line-clamp-3 text-sm leading-relaxed text-[#a1a1aa]">
          {preview ? preview.split('\n').map((line, i, arr) => (
            <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
          )) : 'No caption'}
        </p>
        <div onClick={e => e.stopPropagation()}>
          <CopyBtn text={caption} fullWidth />
        </div>
      </div>
    </Card>
  )
}

// ─── Library modal ─────────────────────────────────────────────────────────────

function LibraryModal({ group, showImage, onClose }: { group: GenerationGroup; showImage: boolean; onClose: () => void }) {
  const [captionExpanded, setCaptionExpanded] = useState(false)

  useEffect(() => {
    setCaptionExpanded(false)
  }, [group])

  const platform = group.caption?.platform ?? group.images[0]?.platform ?? null
  const caption  = group.caption?.text_output ?? ''
  const hashtags = parseHashtags(caption)
  const imageUrl = group.images.find(img => img.image_url)?.image_url ?? null

  return (
    <div
      className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center"
      onClick={onClose}
    >
      <div
        className="relative bg-zinc-950 rounded-2xl overflow-hidden flex flex-col"
        style={{ width: '90vw', maxWidth: '560px', height: '85vh' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-3 right-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 border border-white/20 text-white"
        >
          <X size={16} />
        </button>

        {showImage ? (
          /* ── Has image: cover + caption overlay ── */
          <div
            className="relative flex-1 overflow-hidden"
            onClick={() => setCaptionExpanded(false)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl ?? undefined}
              alt="Generated"
              className="block w-full"
              style={{ maxHeight: '75vh', objectFit: 'contain', background: '#000' }}
            />

            {/* Caption overlay */}
            <div
              className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-4"
              style={{ height: captionExpanded ? '50%' : 'auto' }}
              onClick={e => {
                e.stopPropagation()
                if (!captionExpanded) setCaptionExpanded(true)
              }}
            >
              {captionExpanded ? (
                <div className="flex h-full flex-col cursor-default">
                  <div className="flex shrink-0 items-center justify-between mb-2">
                    <PlatformBadge platform={platform} />
                    <button
                      onClick={e => { e.stopPropagation(); setCaptionExpanded(false) }}
                      className="text-xs text-zinc-400 hover:text-white transition-colors"
                    >
                      ✕ collapse
                    </button>
                  </div>
                  <div
                    className="flex-1 overflow-y-auto text-sm text-white leading-relaxed scrollbar-thin scrollbar-thumb-zinc-600 scrollbar-track-transparent"
                    style={{ userSelect: 'text', cursor: 'text' }}
                    onClick={e => e.stopPropagation()}
                  >
                    {caption ? caption.split('\n').map((line, i, arr) => (
                      <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                    )) : 'No caption'}
                  </div>
                  {hashtags.length > 0 && (
                    <div className="mt-2 flex shrink-0 flex-wrap gap-1" onClick={e => e.stopPropagation()}>
                      {hashtags.map((tag, i) => (
                        <span key={i} className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-indigo-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="cursor-pointer">
                  {caption && (
                    <p className="line-clamp-2 text-sm text-white leading-relaxed">
                      {caption.split('\n').map((line, i, arr) => (
                        <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                      ))}
                    </p>
                  )}
                  {caption && (
                    <p className="text-xs text-zinc-400 mt-1">Tap to read more →</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* ── Caption only ── */
          <div className="flex flex-col h-full">
            <div className="flex-shrink-0 bg-zinc-900 px-5 pt-5 pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <PlatformBadge platform={group.caption?.platform ?? null} />
                <span className="text-xs text-zinc-500 ml-auto">
                  {formatRelativeDate(group.created_at)}
                </span>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              <p className="text-sm text-slate-200 leading-relaxed"
                 style={{ userSelect: 'text', cursor: 'text' }}>
                {group.caption?.text_output
                  ?.split('\n')
                  .map((line, i, arr) => (
                    <span key={i}>{line}{i < arr.length - 1 && <br />}</span>
                  ))}
              </p>
              <div className="flex flex-wrap gap-1 mt-4">
                {group.caption?.text_output
                  ?.split(/\s+/)
                  .filter(w => w.startsWith('#'))
                  .map(tag => (
                    <span key={tag} className="text-xs bg-zinc-800 text-indigo-400 px-2 py-0.5 rounded-full">
                      {tag}
                    </span>
                  ))}
              </div>
            </div>

            <div className="flex-shrink-0 px-5 py-4 border-t border-zinc-800">
              <Button
                className="w-full bg-black text-white border border-white hover:bg-zinc-900"
                onClick={() => { navigator.clipboard.writeText(group.caption?.text_output ?? '') }}
              >
                <Copy className="h-4 w-4 mr-2" /> Copy caption
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
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
  const [filter,         setFilter]         = useState<'all' | 'images' | 'captions'>('all')
  const [selectedGroup,  setSelectedGroup]  = useState<GenerationGroup | null>(null)
  const [modalMode,      setModalMode]      = useState<'full' | 'caption-only'>('full')
  const [loadingMore,    setLoadingMore]    = useState(false)
  const [token,         setToken]         = useState<string | null>(null)
  const [avatarError,   setAvatarError]   = useState(false)
  const [searchQuery,   setSearchQuery]   = useState('')
  const [filterOpen,    setFilterOpen]    = useState(false)

  const fetchLibrary = useCallback(async (jwt: string, page: number, append = false) => {
    const res = await fetch(
      `${WORKER_URL}/api/library?character_id=${characterId}&type=all&page=${page}&limit=50`,
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

  const allGroups = groupGenerations(generations)
  const tabFiltered = filter === 'all'
    ? allGroups
    : filter === 'images'
    ? allGroups.filter(g => g.images.length > 0 && g.images.some(img => img.image_url))
    : allGroups.filter(g => g.caption !== null && !!g.caption?.text_output)
  const filteredGroups = searchQuery.trim()
    ? tabFiltered.filter(g => g.caption?.text_output?.toLowerCase().includes(searchQuery.toLowerCase()))
    : tabFiltered

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <header className="border-b border-[#262626] bg-[#0a0a0a]">
          <div className="mx-auto flex w-full max-w-5xl animate-pulse items-center justify-between gap-3 px-4 py-3 sm:px-6">
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
        <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
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
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <button onClick={() => router.push(`/dashboard/chat?id=${characterId}`)} aria-label="Back"
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
            <Link href={`/dashboard/settings?id=${characterId}`}>
              <Button size="sm" variant="outline" className="gap-1.5 bg-black text-white border-white hover:bg-zinc-900 hover:text-white hover:border-white px-2.5 text-xs sm:px-3">
                <Settings size={13} /> Settings
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">

        {/* ── Title row ── */}
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Library</h2>
          <span className="text-sm text-[#71717a]">
            {searchQuery.trim()
              ? `${filteredGroups.length} result${filteredGroups.length !== 1 ? 's' : ''}`
              : `${meta.total} post${meta.total !== 1 ? 's' : ''}`
            }
          </span>
        </div>

        {/* ── Filter tabs + inline search ── */}
        <div className="flex items-center gap-3 mb-4 relative">
          {/* Desktop filter tabs */}
          <div className="hidden md:flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-lg p-1">
            {(['all', 'images', 'captions'] as const).map(tab => (
              <button key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded-md text-sm capitalize transition-colors ${
                  filter === tab
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}>
                {tab}
              </button>
            ))}
          </div>

          {/* Mobile filter button */}
          <div className="md:hidden relative">
            <button onClick={() => setFilterOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-zinc-300">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {filter === 'all' ? 'All' : filter === 'images' ? 'Images' : 'Captions'}
            </button>
            {filterOpen && (
              <div className="absolute top-full left-0 mt-1 z-20 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden shadow-xl">
                {(['all', 'images', 'captions'] as const).map(tab => (
                  <button key={tab}
                    onClick={() => { setFilter(tab); setFilterOpen(false) }}
                    className={`block w-full text-left px-4 py-2 text-sm ${
                      filter === tab ? 'bg-zinc-700 text-white' : 'text-zinc-400 hover:bg-zinc-800'
                    }`}>
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="relative flex-1 md:flex-none md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search captions..."
              className="w-full h-9 bg-zinc-900 border border-zinc-800 rounded-lg pl-8 pr-8 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* ── Grid ── */}
        {filteredGroups.length === 0 ? (
          searchQuery.trim() ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-3">
              <p className="text-sm text-[#a1a1aa]">{`No results for "${searchQuery}"`}</p>
              <button
                onClick={() => setSearchQuery('')}
                className="text-xs text-indigo-400 hover:text-indigo-300 underline"
              >Clear</button>
            </div>
          ) : (
            <EmptyState characterId={characterId!} />
          )
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredGroups.map((group, i) => {
                const key = group.correlation_id ?? `${group.created_at}-${i}`
                if (filter === 'images') {
                  return <ImageCard key={key} group={group} imageOnly onClick={() => { setModalMode('full'); setSelectedGroup(group) }} />
                }
                const showAsCaption = filter === 'captions' || group.images.length === 0
                return showAsCaption && group.caption
                  ? <CaptionCard key={key} group={group} onClick={() => { setModalMode('caption-only'); setSelectedGroup(group) }} />
                  : group.images.length > 0
                  ? <ImageCard key={key} group={group} onClick={() => { setModalMode('full'); setSelectedGroup(group) }} />
                  : null
              })}
            </div>

            {meta.has_more && (
              <div className="mt-8 flex justify-center">
                <Button onClick={loadMore} disabled={loadingMore} variant="outline"
                  className="bg-black text-white border-white hover:bg-zinc-900 hover:text-white hover:border-white gap-2">
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
        <LibraryModal
          group={selectedGroup}
          showImage={modalMode === 'full' && selectedGroup.images.length > 0 && selectedGroup.images.some(i => i.image_url)}
          onClose={() => { setSelectedGroup(null); setModalMode('full') }}
        />
      )}
    </div>
  )
}
