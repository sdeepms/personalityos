'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Video, ArrowLeft, Download, RefreshCw, CheckCircle2, AlertCircle, Play, Plus, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

type VideoJob = {
  id: string;
  topic: string;
  niche: string;
  tier: string;
  status: string;
  current_step?: string;
  final_video_url?: string;
  duration_seconds?: number;
  created_at: string;
  completed_at?: string;
}

export default function VideoLibraryPage() {
  const router = useRouter()
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [jobs, setJobs] = useState<VideoJob[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      setAuthToken(session.access_token)
      fetchVideoJobs(session.access_token)
    })
  }, [router])

  async function fetchVideoJobs(token: string) {
    try {
      const res = await fetch(`${WORKER_URL}/api/video-jobs`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.data && Array.isArray(data.data)) {
        setJobs(data.data)
      }
    } catch (err: any) {
      console.error('Failed to load video jobs:', err)
      setError('Could not load video library')
    } finally {
      setLoading(false)
    }
  }

  const inProgressJobs = jobs.filter((j) => j.status !== 'completed' && j.status !== 'failed')
  const completedJobs = jobs.filter((j) => j.status === 'completed')

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-6 md:p-12 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Top Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#262626] pb-5">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-lg bg-[#1a1a1a] hover:bg-[#262626] transition text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Video Library <Video className="w-5 h-5 text-indigo-400" />
              </h1>
              <p className="text-sm text-zinc-400">All your generated short-form AI videos and active jobs.</p>
            </div>
          </div>

          <Link href="/dashboard/create-video">
            <Button className="py-5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" /> Create New Video
            </Button>
          </Link>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Active Jobs in Progress */}
        {inProgressJobs.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-400" /> Active Video Generations ({inProgressJobs.length})
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {inProgressJobs.map((j) => (
                <div key={j.id} className="bg-[#141414] border border-indigo-900/40 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-start gap-2">
                    <h3 className="font-medium text-white line-clamp-1">{j.topic}</h3>
                    <span className="px-2.5 py-1 rounded-full text-[10px] uppercase font-bold bg-indigo-950 text-indigo-400 border border-indigo-800">
                      {j.status}
                    </span>
                  </div>
                  <p className="text-xs text-indigo-300 font-mono">{j.current_step || 'Processing video pipeline...'}</p>
                  <div className="w-full bg-[#1f1f1f] h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full w-3/4 animate-pulse rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Completed Videos Grid */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-zinc-200">Completed Videos</h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-64 bg-[#141414] border border-[#262626] rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : completedJobs.length === 0 ? (
            <div className="bg-[#141414] border border-[#262626] rounded-2xl p-12 text-center space-y-4">
              <Video className="w-12 h-12 text-zinc-600 mx-auto" />
              <div>
                <p className="text-base font-medium text-zinc-300">No completed videos yet</p>
                <p className="text-xs text-zinc-500 mt-1">Create your first video job to see completed exports here.</p>
              </div>
              <Link href="/dashboard/create-video" className="inline-block">
                <Button className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-xs">
                  Create Video Now
                </Button>
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {completedJobs.map((j) => (
                <div key={j.id} className="bg-[#141414] border border-[#262626] rounded-2xl overflow-hidden hover:border-zinc-700 transition flex flex-col justify-between">
                  <div className="p-5 space-y-3">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {j.duration_seconds ? `${j.duration_seconds}s` : '1 min'}</span>
                      <span className="uppercase text-[10px] font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-900">{j.tier}</span>
                    </div>

                    <h3 className="font-semibold text-white text-base line-clamp-2 leading-snug">{j.topic}</h3>
                    <p className="text-xs text-zinc-400">{j.niche}</p>
                  </div>

                  <div className="p-5 border-t border-[#262626] bg-[#1a1a1a]/50">
                    {j.final_video_url ? (
                      <a
                        href={j.final_video_url.includes('ForBiggerBlazes') ? 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4' : j.final_video_url}
                        target="_blank"
                        rel="noreferrer"
                        className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-xs flex items-center justify-center gap-2 transition"
                      >
                        <Download className="w-4 h-4" /> Download Video
                      </a>
                    ) : (
                      <span className="text-xs text-zinc-500">Video link processing</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
