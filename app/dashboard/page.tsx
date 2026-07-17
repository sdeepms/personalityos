'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { User } from '@supabase/supabase-js'
import { Sparkles, Video, UserCheck, Plus, ArrowRight, RefreshCw, Film, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

type VideoJob = {
  id: string
  topic: string
  niche: string
  tier: string
  status: string
  current_step?: string
  final_video_url?: string
  created_at: string
}

export default function DashboardPage() {
  const [user, setUser] = useState<User | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [recentJobs, setRecentJobs] = useState<VideoJob[]>([])
  const [loadingJobs, setLoadingJobs] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.replace('/login')
        return
      }

      setUser(session.user)
      setAuthToken(session.access_token)

      try {
        const res = await fetch(`${WORKER_URL}/api/video-jobs`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json()
        if (json.data && Array.isArray(json.data)) {
          setRecentJobs(json.data.slice(0, 5))
        }
      } catch (err) {
        console.error('Failed to fetch video jobs:', err)
      } finally {
        setLoadingJobs(false)
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
    <div className="min-h-screen bg-[#0d0d0d] text-white font-sans">
      {/* Top Header */}
      <header className="border-b border-[#262626] bg-[#0d0d0d]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-white tracking-tight flex items-center gap-2">
              PersonalityOS <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800 font-mono">V2</span>
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-zinc-400 hidden sm:inline">{user?.email}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSignOut}
              className="bg-black text-white border-zinc-800 hover:bg-zinc-900 hover:text-white hover:border-zinc-700 text-xs"
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        {/* Hero Section */}
        <div className="space-y-3">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
            Short-Form AI Video Pipeline <Sparkles className="w-6 h-6 text-indigo-400" />
          </h1>
          <p className="text-zinc-400 max-w-2xl text-sm leading-relaxed">
            Autonomous video generation powered by Gemini, Claude, Sarvam AI, and LatentSync. Extract creator DNA, generate grounded scripts, approve content, and render finished videos automatically.
          </p>
        </div>

        {/* Core V2 Action Modules */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Module 1: Creator DNA Setup */}
          <Link href="/dashboard/creator-setup" className="group block">
            <div className="h-full bg-[#141414] border border-[#262626] rounded-2xl p-6 hover:border-indigo-500/60 transition duration-200 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-900 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">1. Creator DNA Setup</h2>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Configure your AI persona using Photo (Option A) or Video (Option B) onboarding. Stores gestures, voice tone, and fixed outro.
                  </p>
                </div>
              </div>
              <div className="flex items-center text-xs font-medium text-indigo-400 group-hover:translate-x-1 transition-transform">
                Configure Creator DNA <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </Link>

          {/* Module 2: Create AI Video */}
          <Link href="/dashboard/create-video" className="group block">
            <div className="h-full bg-[#141414] border border-[#262626] rounded-2xl p-6 hover:border-indigo-500/60 transition duration-200 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-900 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <Plus className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">2. Create AI Video</h2>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    Submit a topic prompt to trigger style adaptation, Gemini research, script drafting, interactive editing & lip-sync pipeline.
                  </p>
                </div>
              </div>
              <div className="flex items-center text-xs font-medium text-indigo-400 group-hover:translate-x-1 transition-transform">
                Start Video Pipeline <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </Link>

          {/* Module 3: Video Library */}
          <Link href="/dashboard/videos" className="group block">
            <div className="h-full bg-[#141414] border border-[#262626] rounded-2xl p-6 hover:border-indigo-500/60 transition duration-200 flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-950/60 border border-indigo-900 flex items-center justify-center text-indigo-400 group-hover:scale-105 transition-transform">
                  <Video className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-white group-hover:text-indigo-300 transition-colors">3. Video Library</h2>
                  <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                    View active generation status, real-time stage progress, completed video renders, and direct MP4 downloads.
                  </p>
                </div>
              </div>
              <div className="flex items-center text-xs font-medium text-indigo-400 group-hover:translate-x-1 transition-transform">
                View Video Library <ArrowRight className="w-4 h-4 ml-1" />
              </div>
            </div>
          </Link>
        </div>

        {/* Pipeline Recent Activity */}
        <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-indigo-400" /> Recent Video Jobs
            </h2>
            <Link href="/dashboard/videos">
              <Button variant="outline" size="sm" className="border-[#262626] hover:bg-[#1a1a1a] text-zinc-400 text-xs">
                View All
              </Button>
            </Link>
          </div>

          {loadingJobs ? (
            <div className="h-24 bg-[#1f1f1f] rounded-xl animate-pulse" />
          ) : recentJobs.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Video className="w-10 h-10 text-zinc-600 mx-auto" />
              <p className="text-sm text-zinc-400">No video jobs created yet.</p>
              <Link href="/dashboard/create-video" className="inline-block">
                <Button size="sm" className="bg-indigo-600 hover:bg-indigo-500 text-white text-xs">
                  Create First Video
                </Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 rounded-xl bg-[#1a1a1a] border border-[#262626] text-sm">
                  <div className="space-y-1">
                    <p className="font-medium text-white">{job.topic}</p>
                    <p className="text-xs text-zinc-500">{job.niche} • Status: <span className="text-indigo-400 uppercase font-mono">{job.status}</span></p>
                  </div>
                  {job.status === 'completed' && job.final_video_url ? (
                    <a
                      href={job.final_video_url.includes('ForBiggerBlazes') ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' : job.final_video_url}
                      target="_blank"
                      rel="noreferrer"
                      className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition"
                    >
                      Watch Video
                    </a>
                  ) : job.status === 'awaiting_approval' ? (
                    <Link
                      href="/dashboard/create-video"
                      className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-medium transition"
                    >
                      Review Script
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1.5 text-xs text-indigo-400 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Processing
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
