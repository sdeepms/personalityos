'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

type Character = {
  id: string
  name: string
  domain: string
  style_preset: string
  dna_ready: number
  created_at: string
}

function CharacterCardSkeleton() {
  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 animate-pulse">
      <div className="h-4 w-1/2 rounded bg-[#262626]" />
      <div className="mt-2 h-3 w-3/4 rounded bg-[#262626]" />
      <div className="mt-4 h-8 w-24 rounded-lg bg-[#262626]" />
    </div>
  )
}

function CharacterCard({ character }: { character: Character }) {
  const router = useRouter()
  return (
    <div className="rounded-xl border border-[#262626] bg-[#141414] p-5 transition-colors hover:border-[#404040]">
      <div className="flex items-start justify-between gap-3">
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
      <div className="mt-4">
        <Button
          size="sm"
          onClick={() => router.push(`/dashboard/${character.id}/chat`)}
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

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
        return
      }
      setUser(user)

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      try {
        const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'
        const res = await fetch(`${workerUrl}/api/characters`, {
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
