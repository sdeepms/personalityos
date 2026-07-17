'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowLeft, CheckCircle2, RefreshCw, AlertCircle, FileText, Video, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

type Character = {
  id: string
  name: string
  domain: string
  subscription_tier?: string
}

type VideoJob = {
  id: string
  creator_id: string
  tier: string
  topic: string
  niche: string
  language: string
  status: string
  current_step?: string
  generated_script?: string
  approved_script?: string
  research_brief?: string
  audio_url?: string
  lipsync_video_url?: string
  final_video_url?: string
  word_count?: number
  duration_seconds?: number
  created_at: string
}

export default function CreateVideoPage() {
  const router = useRouter()
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [characters, setCharacters] = useState<Character[]>([])
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('')
  
  const [topic, setTopic] = useState('')
  const [niche, setNiche] = useState('Education')
  const [language, setLanguage] = useState('hi-IN')

  const [loadingCharacters, setLoadingCharacters] = useState(true)
  const [creatingJob, setCreatingJob] = useState(false)
  const [approving, setApproving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [activeJob, setActiveJob] = useState<VideoJob | null>(null)
  const [editableScript, setEditableScript] = useState('')

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      setAuthToken(session.access_token)
      fetchCharacters(session.access_token)
    })
  }, [router])

  async function fetchCharacters(token: string) {
    try {
      const res = await fetch(`${WORKER_URL}/api/characters`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json()
      if (data.data && Array.isArray(data.data)) {
        setCharacters(data.data)
        if (data.data.length > 0) {
          setSelectedCharacterId(data.data[0].id)
          setNiche(data.data[0].domain || 'Education')
        }
      }
    } catch (err) {
      console.error('Failed to load characters:', err)
    } finally {
      setLoadingCharacters(false)
    }
  }

  // Poll job status if activeJob is in progress
  useEffect(() => {
    if (!activeJob || !authToken) return
    const isFinished = activeJob.status === 'awaiting_approval' || activeJob.status === 'completed' || activeJob.status === 'failed'
    if (isFinished) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`${WORKER_URL}/api/video-jobs/${activeJob.id}`, {
          headers: { Authorization: `Bearer ${authToken}` },
        })
        const data = await res.json()
        if (data.data) {
          setActiveJob(data.data)
          if (data.data.status === 'awaiting_approval' && data.data.approved_script) {
            setEditableScript(data.data.approved_script || data.data.generated_script || '')
          }
        }
      } catch (err) {
        console.error('Job polling error:', err)
      }
    }, 3000)

    return () => clearInterval(interval)
  }, [activeJob, authToken])

  async function handleStartPipeline(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedCharacterId) {
      setError('Please select a character profile.')
      return
    }
    if (!topic.trim()) {
      setError('Please enter a topic for the video.')
      return
    }

    setError(null)
    setCreatingJob(true)

    try {
      const res = await fetch(`${WORKER_URL}/api/video-jobs`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          creator_id: selectedCharacterId,
          topic,
          niche,
          language,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create video job')

      setActiveJob(data.data)
    } catch (err: any) {
      setError(err.message || 'Error creating video job')
    } finally {
      setCreatingJob(false)
    }
  }

  async function handleApproveScript() {
    if (!activeJob || !authToken) return
    setApproving(true)
    setError(null)

    try {
      const res = await fetch(`${WORKER_URL}/api/video-jobs/${activeJob.id}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          approved_script: editableScript,
        }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to approve script')

      setActiveJob(data.data)
    } catch (err: any) {
      setError(err.message || 'Error approving script')
    } finally {
      setApproving(false)
    }
  }

  const selectedChar = characters.find((c) => c.id === selectedCharacterId)
  const currentTier = selectedChar?.subscription_tier || 'standard'
  const calculatedWords = editableScript.trim() ? editableScript.trim().split(/\s+/).length : 0
  const estimatedSeconds = Math.round((calculatedWords / 140) * 60)

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white p-6 md:p-12 font-sans">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#262626] pb-5">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="p-2 rounded-lg bg-[#1a1a1a] hover:bg-[#262626] transition text-zinc-400 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
                Create AI Video <Sparkles className="w-5 h-5 text-indigo-400" />
              </h1>
              <p className="text-sm text-zinc-400">Generate high-impact short-form videos with automatic script research & lip sync.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1 & Step 2: Form Input */}
        {!activeJob && (
          <form onSubmit={handleStartPipeline} className="space-y-6 bg-[#141414] border border-[#262626] rounded-2xl p-6 md:p-8">
            <h2 className="text-lg font-semibold text-zinc-200">1. Select Character Profile</h2>
            
            {loadingCharacters ? (
              <div className="h-20 bg-[#1f1f1f] rounded-xl animate-pulse" />
            ) : characters.length === 0 ? (
              <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-800 text-amber-300 text-sm">
                No creator profiles found. Please <Link href="/dashboard/creator-setup" className="underline font-medium">set up your Creator DNA</Link> first.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {characters.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCharacterId(c.id)
                      setNiche(c.domain || 'Education')
                    }}
                    className={`p-4 rounded-xl border text-left transition flex justify-between items-center ${
                      selectedCharacterId === c.id
                        ? 'border-indigo-500 bg-indigo-950/20 text-white'
                        : 'border-[#262626] bg-[#1a1a1a] text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div>
                      <div className="font-medium text-zinc-200">{c.name}</div>
                      <div className="text-xs text-zinc-500">{c.domain} • Tier: <span className="uppercase text-indigo-400">{c.subscription_tier || 'Standard'}</span></div>
                    </div>
                    {selectedCharacterId === c.id && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                  </button>
                ))}
              </div>
            )}

            <div className="border-t border-[#262626] pt-6 space-y-6">
              <h2 className="text-lg font-semibold text-zinc-200">2. Video Topic & Settings</h2>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Topic Title / Prompt</label>
                <input
                  type="text"
                  placeholder="e.g. 3 Secret Time Management Hacks for Competitive Exams"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#262626] text-white focus:outline-none focus:border-indigo-500 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Niche</label>
                  <input
                    type="text"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#262626] text-white focus:outline-none focus:border-indigo-500 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Language</label>
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#262626] text-white focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="hi-IN">Hindi / Hinglish (hi-IN)</option>
                    <option value="en-IN">English (Indian Context) (en-IN)</option>
                  </select>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-[#1a1a1a] border border-[#262626] flex items-center justify-between text-xs text-zinc-400">
                <span>Target Length: <strong className="text-white uppercase">{currentTier} Tier (~130 words / 1 min)</strong></span>
                <span className="text-indigo-400 font-medium">Automatic Fixed Outro Included</span>
              </div>

              <Button
                type="submit"
                disabled={creatingJob || characters.length === 0}
                className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-base flex items-center justify-center gap-2"
              >
                {creatingJob ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" /> Starting Research & Script Generation...
                  </>
                ) : (
                  <>
                    Research & Write Script <ArrowLeft className="w-5 h-5 rotate-180" />
                  </>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* Progress Polling Banner */}
        {activeJob && activeJob.status !== 'awaiting_approval' && activeJob.status !== 'completed' && activeJob.status !== 'failed' && (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-8 text-center space-y-6">
            <div className="inline-flex p-4 rounded-full bg-indigo-950/50 border border-indigo-800 text-indigo-400">
              <RefreshCw className="w-8 h-8 animate-spin" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">Pipeline Execution in Progress</h2>
              <p className="text-sm text-indigo-400 font-medium mt-1">{activeJob.current_step || 'Processing video agents...'}</p>
              <p className="text-xs text-zinc-500 mt-2">Topic: "{activeJob.topic}"</p>
            </div>
            <div className="w-full bg-[#1f1f1f] h-2 rounded-full overflow-hidden">
              <div className="bg-indigo-500 h-full w-2/3 animate-pulse rounded-full" />
            </div>
          </div>
        )}

        {/* Step 3: Script Approval UI */}
        {activeJob && activeJob.status === 'awaiting_approval' && (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-6 md:p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-[#262626] pb-4">
              <div>
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">Step 3 of 3 • Script Approval</span>
                <h2 className="text-xl font-bold text-white mt-1">Review & Approve Video Script</h2>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveJob(null)}
                className="text-xs border-[#262626] hover:bg-[#1f1f1f] text-zinc-400"
              >
                New Topic
              </Button>
            </div>

            {/* Outro notice banner */}
            <div className="p-4 rounded-xl bg-indigo-950/30 border border-indigo-800 text-indigo-300 text-xs flex items-center gap-3">
              <Video className="w-5 h-5 shrink-0" />
              <span>A fixed outro from your Creator DNA will be automatically stitched at the end of this video. Do not add closing sign-offs.</span>
            </div>

            {/* Editable Script Textarea */}
            <div>
              <div className="flex justify-between items-center text-xs text-zinc-400 mb-2">
                <span className="flex items-center gap-1"><FileText className="w-4 h-4 text-indigo-400" /> Script Draft</span>
                <span>Word Count: <strong className="text-white">{calculatedWords} words</strong> (Est: ~{estimatedSeconds}s)</span>
              </div>
              <textarea
                value={editableScript}
                onChange={(e) => setEditableScript(e.target.value)}
                rows={10}
                className="w-full p-4 rounded-xl bg-[#1a1a1a] border border-[#262626] text-zinc-200 text-sm leading-relaxed focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <Button
                onClick={handleApproveScript}
                disabled={approving || !editableScript.trim()}
                className="flex-1 py-6 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-xl text-base flex items-center justify-center gap-2"
              >
                {approving ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" /> Approving & Generating Video...
                  </>
                ) : (
                  <>
                    Approve & Generate Video <Play className="w-5 h-5 fill-current" />
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Completed Job Status */}
        {activeJob && activeJob.status === 'completed' && (
          <div className="bg-[#141414] border border-emerald-800/50 rounded-2xl p-8 text-center space-y-6">
            <div className="inline-flex p-4 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Video Ready!</h2>
              <p className="text-sm text-zinc-400 mt-1">Your video job "{activeJob.topic}" has been generated successfully.</p>
            </div>
            {activeJob.final_video_url && (
              <div className="pt-2">
                <a
                  href={activeJob.final_video_url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm transition"
                >
                  Download Final Video
                </a>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
