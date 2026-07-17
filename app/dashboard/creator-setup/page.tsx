'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Sparkles, ArrowLeft, Upload, CheckCircle2, RefreshCw, AlertCircle, Camera, Video, UserCheck, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

type OnboardingOption = 'option_a' | 'option_b'

export default function CreatorSetupPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)

  const [authToken, setAuthToken] = useState<string | null>(null)
  const [option, setOption] = useState<OnboardingOption>('option_a')

  const [creatorName, setCreatorName] = useState('')
  const [niche, setNiche] = useState('Education')
  const [speakingTone, setSpeakingTone] = useState('conversational')
  const [visualStyle, setVisualStyle] = useState('smart casual')

  const [uploadedPhotos, setUploadedPhotos] = useState<File[]>([])
  const [uploadedVideo, setUploadedVideo] = useState<File | null>(null)

  const [processing, setProcessing] = useState(false)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [completed, setCompleted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
        return
      }
      setAuthToken(session.access_token)
    })
  }, [router])

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return
    const files = Array.from(e.target.files)
    setUploadedPhotos((prev) => [...prev, ...files].slice(0, 5))
  }

  function handleVideoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files || e.target.files.length === 0) return
    setUploadedVideo(e.target.files[0])
  }

  async function handleStartSetup(e: React.FormEvent) {
    e.preventDefault()
    if (!creatorName.trim()) {
      setError('Please enter your Creator / Character name.')
      return
    }

    if (option === 'option_a' && uploadedPhotos.length === 0) {
      setError('Please upload at least 1 high-quality face photo for Option A.')
      return
    }

    if (option === 'option_b' && !uploadedVideo) {
      setError('Please upload an explainer video file for Option B.')
      return
    }

    setError(null)
    setProcessing(true)
    setCurrentStepIndex(1)

    // Simulated progress transitions for onboarding workflow
    setTimeout(() => {
      setCurrentStepIndex(2)
    }, 2500)

    setTimeout(() => {
      setCurrentStepIndex(3)
    }, 5500)

    setTimeout(() => {
      setProcessing(false)
      setCompleted(true)
    }, 8500)
  }

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
                Creator DNA Setup <Sparkles className="w-5 h-5 text-indigo-400" />
              </h1>
              <p className="text-sm text-zinc-400">Configure your permanent AI avatar persona, voice tone, and gesture profile.</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Setup Form */}
        {!processing && !completed && (
          <form onSubmit={handleStartSetup} className="space-y-8 bg-[#141414] border border-[#262626] rounded-2xl p-6 md:p-8">
            {/* Option Selection */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-3">Choose Onboarding Method</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setOption('option_a')}
                  className={`p-5 rounded-2xl border text-left transition space-y-2 ${
                    option === 'option_a'
                      ? 'border-indigo-500 bg-indigo-950/20 text-white'
                      : 'border-[#262626] bg-[#1a1a1a] text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-100 flex items-center gap-2">
                      <Camera className="w-5 h-5 text-indigo-400" /> Option A: Photo-Based Setup
                    </span>
                    {option === 'option_a' && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Upload 1-5 face photos. We automatically generate your reference gesture avatar video and store it in Creator DNA.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setOption('option_b')}
                  className={`p-5 rounded-2xl border text-left transition space-y-2 ${
                    option === 'option_b'
                      ? 'border-indigo-500 bg-indigo-950/20 text-white'
                      : 'border-[#262626] bg-[#1a1a1a] text-zinc-400 hover:border-zinc-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-zinc-100 flex items-center gap-2">
                      <Video className="w-5 h-5 text-indigo-400" /> Option B: Video-Based Setup
                    </span>
                    {option === 'option_b' && <CheckCircle2 className="w-5 h-5 text-indigo-400" />}
                  </div>
                  <p className="text-xs text-zinc-400 leading-relaxed">
                    Upload an existing 15-60s explainer video file. Our Style Learning Agent automatically extracts your framing, pacing, and gestures.
                  </p>
                </button>
              </div>
            </div>

            {/* Profile Basics */}
            <div className="space-y-4 pt-4 border-t border-[#262626]">
              <h2 className="text-lg font-semibold text-zinc-200">Basic Information</h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Creator Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Vikas Sharma"
                    value={creatorName}
                    onChange={(e) => setCreatorName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#262626] text-white focus:outline-none focus:border-indigo-500 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Niche / Domain</label>
                  <input
                    type="text"
                    placeholder="e.g. UPSC / Finance / Tech"
                    value={niche}
                    onChange={(e) => setNiche(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#262626] text-white focus:outline-none focus:border-indigo-500 text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Speaking Tone</label>
                  <select
                    value={speakingTone}
                    onChange={(e) => setSpeakingTone(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#262626] text-white focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="conversational">Conversational & Engaging</option>
                    <option value="energetic">Energetic & High Impact</option>
                    <option value="academic">Academic & Authoritative</option>
                    <option value="motivational">Motivational & Direct</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Visual Style Preference</label>
                  <select
                    value={visualStyle}
                    onChange={(e) => setVisualStyle(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-[#1a1a1a] border border-[#262626] text-white focus:outline-none focus:border-indigo-500 text-sm"
                  >
                    <option value="smart casual">Smart Casual (Studio Lighting)</option>
                    <option value="business formal">Business Formal</option>
                    <option value="modern minimalist">Modern Minimalist Dark</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Media Upload Section */}
            <div className="space-y-4 pt-4 border-t border-[#262626]">
              {option === 'option_a' ? (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Upload Face Photos (1-5 images)</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-[#333333] hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-[#1a1a1a] transition"
                  >
                    <Upload className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-zinc-200">Click to select photos</p>
                    <p className="text-xs text-zinc-500 mt-1">PNG, JPG or WEBP up to 10MB each</p>
                  </div>

                  {uploadedPhotos.length > 0 && (
                    <div className="flex gap-3 mt-4 overflow-x-auto pb-2">
                      {uploadedPhotos.map((f, idx) => (
                        <div key={idx} className="px-3 py-2 rounded-lg bg-[#262626] text-xs text-zinc-300 flex items-center gap-2 shrink-0">
                          <Camera className="w-3.5 h-3.5 text-indigo-400" /> {f.name}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">Upload Reference Explainer Video (15-60 seconds)</label>
                  <input
                    type="file"
                    ref={videoInputRef}
                    accept="video/mp4,video/mov,video/webm"
                    onChange={handleVideoUpload}
                    className="hidden"
                  />
                  <div
                    onClick={() => videoInputRef.current?.click()}
                    className="border-2 border-dashed border-[#333333] hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer bg-[#1a1a1a] transition"
                  >
                    <Video className="w-8 h-8 text-zinc-400 mx-auto mb-2" />
                    <p className="text-sm font-medium text-zinc-200">Click to upload video file</p>
                    <p className="text-xs text-zinc-500 mt-1">MP4, MOV or WEBM up to 50MB</p>
                  </div>

                  {uploadedVideo && (
                    <div className="mt-4 px-3 py-2 rounded-lg bg-[#262626] text-xs text-zinc-300 inline-flex items-center gap-2">
                      <Video className="w-3.5 h-3.5 text-indigo-400" /> {uploadedVideo.name}
                    </div>
                  )}
                </div>
              )}
            </div>

            <Button
              type="submit"
              className="w-full py-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-base flex items-center justify-center gap-2"
            >
              Initialize Creator DNA <ArrowLeft className="w-5 h-5 rotate-180" />
            </Button>
          </form>
        )}

        {/* Processing Status Panel */}
        {processing && (
          <div className="bg-[#141414] border border-[#262626] rounded-2xl p-8 space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold text-white">Setting up your Creator DNA profile</h2>
              <p className="text-xs text-zinc-400">This takes approximately 1-2 minutes. You can leave this page open.</p>
            </div>

            <div className="space-y-4 max-w-md mx-auto">
              <div className="flex items-center gap-3 text-sm text-emerald-400">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>Reference media files uploaded</span>
              </div>

              <div className={`flex items-center gap-3 text-sm ${currentStepIndex >= 1 ? 'text-indigo-400' : 'text-zinc-500'}`}>
                {currentStepIndex === 1 ? <RefreshCw className="w-5 h-5 animate-spin shrink-0" /> : currentStepIndex > 1 ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <div className="w-5 h-5 rounded-full border border-zinc-700" />}
                <span>Running Style Learning Agent...</span>
              </div>

              <div className={`flex items-center gap-3 text-sm ${currentStepIndex >= 2 ? 'text-indigo-400' : 'text-zinc-500'}`}>
                {currentStepIndex === 2 ? <RefreshCw className="w-5 h-5 animate-spin shrink-0" /> : currentStepIndex > 2 ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <div className="w-5 h-5 rounded-full border border-zinc-700" />}
                <span>Generating reference gesture video A...</span>
              </div>

              <div className={`flex items-center gap-3 text-sm ${currentStepIndex >= 3 ? 'text-indigo-400' : 'text-zinc-500'}`}>
                {currentStepIndex === 3 ? <RefreshCw className="w-5 h-5 animate-spin shrink-0" /> : currentStepIndex > 3 ? <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" /> : <div className="w-5 h-5 rounded-full border border-zinc-700" />}
                <span>Storing profile & fixed outro to Creator DNA...</span>
              </div>
            </div>
          </div>
        )}

        {/* Completion Panel */}
        {completed && (
          <div className="bg-[#141414] border border-emerald-800/50 rounded-2xl p-8 text-center space-y-6">
            <div className="inline-flex p-4 rounded-full bg-emerald-950/50 text-emerald-400 border border-emerald-800">
              <UserCheck className="w-8 h-8" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Creator DNA Ready!</h2>
              <p className="text-sm text-zinc-400 mt-1">Your creator profile "{creatorName}" has been established successfully.</p>
            </div>

            <div className="flex justify-center gap-4 pt-2">
              <Link href="/dashboard/create-video">
                <Button className="py-5 px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-xl text-sm flex items-center gap-2">
                  Create Your First Video <Play className="w-4 h-4 fill-current" />
                </Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
