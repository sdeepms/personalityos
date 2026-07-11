'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

type ReferenceImage = {
  url: string
  pose_type: string
  is_primary: boolean
}

type Character = {
  id: string
  name: string
  domain: string
  style_preset: string
  dna_ready: number
  reference_images_ready: number
  reference_image_urls: string
  created_at: string
  updated_at?: string
  generation_count?: number
  character_type?: string | null
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

function getInitials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

function CharacterCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] overflow-hidden animate-pulse">
      <div className="h-56 bg-[#1f1f1f]" />
      <div className="px-4 py-3 flex items-center justify-between">
        <div className="h-3 w-14 rounded bg-[#262626]" />
        <div className="flex gap-2">
          <div className="h-7 w-20 rounded-lg bg-[#262626]" />
          <div className="h-7 w-20 rounded-lg bg-[#262626]" />
        </div>
      </div>
    </div>
  )
}

function CharacterCard({ character }: { character: Character }) {
  const router = useRouter()

  let primaryImageUrl: string | null = null
  if (character.reference_images_ready === 1 && character.reference_image_urls) {
    try {
      const refs: ReferenceImage[] = JSON.parse(character.reference_image_urls)
      const primary = refs.find((r) => r.is_primary) ?? refs[0]
      if (primary?.url) {
        primaryImageUrl = `${WORKER_URL}/files/${primary.url}`
      }
    } catch {
      primaryImageUrl = null
    }
  }

  return (
    <div
      className="group rounded-xl border border-zinc-800 bg-zinc-950 overflow-hidden cursor-pointer hover:border-zinc-600 transition-all duration-200"
      onClick={() => router.push(`/dashboard/chat?id=${character.id}`)}
    >
      {/* Image area */}
      <div className="relative h-56 overflow-hidden bg-zinc-900">
        {primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImageUrl}
            alt={`${character.name} reference`}
            className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/20">
            <span className="text-5xl font-bold text-indigo-400/60 select-none">
              {getInitials(character.name)}
            </span>
          </div>
        )}
        {/* Edit button */}
        <button
          onClick={(e) => {
            e.stopPropagation()
            router.push(`/dashboard/settings?id=${character.id}`)
          }}
          className="absolute top-2 right-2 z-10 h-7 w-7 rounded-full bg-black/60 border border-white/20 text-white hover:bg-black hover:border-white/50 flex items-center justify-center transition-all"
          title="Edit character"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>

        {/* Name + domain overlay */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-8">
          <p className="text-lg font-bold text-white leading-tight">
            {character.name}
            {character.character_type === 'educator' && <span className="ml-1.5 text-base">🎓</span>}
            {character.character_type === 'creator'  && <span className="ml-1.5 text-base">✨</span>}
          </p>
          <p className="text-xs text-zinc-400">{character.domain}</p>
        </div>
      </div>

      {/* Card body */}
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          {(character.generation_count ?? 0) > 0 ? (
            <span className="text-xs text-zinc-500">{character.generation_count} posts</span>
          ) : (
            <span className="text-xs text-zinc-600">No posts yet</span>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => router.push(`/dashboard/chat?id=${character.id}`)}
          className="bg-indigo-600 text-white hover:bg-indigo-500"
        >
          Open Chat
        </Button>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      setUser(session.user)

      try {
        const res = await fetch(`${WORKER_URL}/api/characters`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json() as { data?: Character[]; error?: string }
        if (res.ok) {
          const chars = json.data ?? []
          try {
            const counts = await Promise.all(
              chars.map(async (c) => {
                const r = await fetch(
                  `${WORKER_URL}/api/library?character_id=${c.id}&type=all&page=1&limit=1`,
                  { headers: { Authorization: `Bearer ${session.access_token}` } }
                )
                const j = await r.json() as { meta?: { total?: number } }
                return { id: c.id, count: j.meta?.total ?? 0 }
              })
            )
            const countMap = Object.fromEntries(counts.map(c => [c.id, c.count]))
            setCharacters(chars.map(c => ({ ...c, generation_count: countMap[c.id] ?? 0 })))
          } catch {
            setCharacters(chars)
          }
        } else {
          setFetchError(json.error ?? 'Failed to load characters.')
        }
      } catch {
        setFetchError('Network error. Please refresh.')
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [router])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#262626] bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold text-white">PersonalityOS</span>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#71717a]">{user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="bg-black text-white border-white hover:bg-zinc-900 hover:text-white hover:border-white"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Your Characters</h1>
            <p className="mt-1 text-sm text-[#a1a1aa]">
              Each character is a complete AI identity with its own voice, style, and visual DNA.
            </p>
          </div>
          <Link href="/dashboard/create">
            <Button className="w-full md:w-auto bg-indigo-600 text-white hover:bg-indigo-500">
              + Create Character
            </Button>
          </Link>
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <CharacterCardSkeleton />
              <CharacterCardSkeleton />
              <CharacterCardSkeleton />
            </div>
          ) : fetchError ? (
            <div className="rounded-xl border border-red-900/50 bg-red-950/20 p-6 text-center">
              <p className="text-sm text-red-400">{fetchError}</p>
              <button
                onClick={() => window.location.reload()}
                className="mt-3 text-xs text-[#71717a] underline hover:text-white"
              >
                Try again
              </button>
            </div>
          ) : characters.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
              <div className="text-6xl mb-6">🎭</div>
              <h2 className="text-xl font-semibold text-white mb-2">No characters yet</h2>
              <p className="text-sm text-zinc-500 max-w-sm mb-8">
                Create your first AI character. Give it a face, a voice, and a domain. Then start generating content in seconds.
              </p>
              <Link href="/dashboard/create">
                <Button className="bg-indigo-600 text-white hover:bg-indigo-500 px-8 py-5 text-base">
                  Create your first character
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((c) => (
                <CharacterCard key={c.id} character={c} />
              ))}
              <Link href="/dashboard/create" className="block">
                <div className="group rounded-xl border-2 border-dashed border-indigo-500/40 bg-indigo-500/5 md:border-zinc-700 md:bg-transparent h-full min-h-[120px] md:min-h-[280px] flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all duration-200">
                  <div className="h-12 w-12 rounded-full border-2 border-zinc-600 group-hover:border-indigo-400 flex items-center justify-center transition-colors">
                    <span className="text-2xl text-zinc-500 group-hover:text-indigo-400 transition-colors leading-none">+</span>
                  </div>
                  <div className="text-center px-4">
                    <p className="text-sm font-medium text-zinc-400 group-hover:text-white transition-colors">New Character</p>
                    <p className="text-xs text-zinc-600 mt-1 group-hover:text-zinc-400 transition-colors">Add another identity</p>
                  </div>
                </div>
              </Link>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
