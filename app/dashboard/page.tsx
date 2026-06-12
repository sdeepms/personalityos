'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
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
      <div className="h-36 bg-[#1f1f1f]" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-1/2 rounded bg-[#262626]" />
        <div className="h-3 w-3/4 rounded bg-[#262626]" />
        <div className="mt-3 h-8 w-24 rounded-lg bg-[#262626]" />
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
    <div className="rounded-xl border border-[#262626] bg-[#141414] overflow-hidden transition-colors hover:border-[#404040]">
      {/* Thumbnail */}
      <div className="relative h-36 bg-[#1a1a1a] flex items-center justify-center overflow-hidden">
        {primaryImageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={primaryImageUrl}
            alt={`${character.name} reference`}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-indigo-900/30 to-purple-900/20">
            <span className="text-3xl font-bold text-indigo-400/60 select-none">
              {getInitials(character.name)}
            </span>
          </div>
        )}
        {character.reference_images_ready === 1 && (
          <div className="absolute top-2 right-2 rounded-full bg-green-500/20 border border-green-500/30 px-2 py-0.5">
            <span className="text-xs text-green-400 font-medium">Photos added</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-white">{character.name}</h3>
            <p className="mt-0.5 truncate text-sm text-[#a1a1aa]">{character.domain}</p>
          </div>
          {character.dna_ready === 1 && (
            <span className="shrink-0 rounded-full bg-indigo-500/10 px-2 py-0.5 text-xs font-medium text-indigo-400">
              Ready
            </span>
          )}
        </div>

        <div className="mt-3 flex gap-2">
          <Button
            size="sm"
            onClick={() => router.push(`/dashboard/chat?id=${character.id}`)}
            className="bg-indigo-600 text-white hover:bg-indigo-500"
          >
            Open Chat
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => router.push(`/dashboard/settings?id=${character.id}`)}
            className="border-[#262626] text-[#a1a1aa] hover:text-white hover:border-[#404040]"
          >
            {character.reference_images_ready !== 1 ? 'Add Photos' : 'Settings'}
          </Button>
        </div>
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

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      setUser(user)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      try {
        const res = await fetch(`${WORKER_URL}/api/characters`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json() as { data?: Character[]; error?: string }
        if (res.ok) {
          setCharacters(json.data ?? [])
        } else {
          setFetchError(json.error ?? 'Failed to load characters.')
        }
      } catch {
        setFetchError('Network error. Please refresh.')
      } finally {
        setLoading(false)
      }
    })
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
              className="border-[#262626] text-[#a1a1aa] hover:text-white"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Your Characters</h1>
            <p className="mt-1 text-sm text-[#a1a1aa]">
              Each character is a complete AI identity with its own voice, style, and visual DNA.
            </p>
          </div>
          <Link href="/dashboard/create">
            <Button className="bg-indigo-600 text-white hover:bg-indigo-500">
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
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#262626] py-20 text-center">
              <p className="text-sm font-medium text-white">No characters yet</p>
              <p className="mt-1 text-sm text-[#71717a]">
                Create your first AI character to start generating content.
              </p>
              <Link href="/dashboard/create" className="mt-5">
                <Button className="bg-indigo-600 text-white hover:bg-indigo-500">
                  Create your first character
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {characters.map((c) => (
                <CharacterCard key={c.id} character={c} />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
