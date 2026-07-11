'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Upload } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

type Step = 'type' | 'form' | 'preview'
type CharacterType = 'educator' | 'creator'

const EDUCATOR_CHIPS = ['UPSC', 'Finance', 'Startup', 'Coaching', 'History', 'Ethics', 'Science', 'Law', 'Other']
const CREATOR_CHIPS = ['Startup', 'Lifestyle', 'Tech', 'Fitness', 'Fashion', 'Food', 'Travel', 'Finance', 'Other']

const STYLE_PRESETS: Record<CharacterType, Array<{ id: string; name: string; desc: string }>> = {
  educator: [
    { id: 'engaging_explainer', name: 'Engaging Explainer', desc: 'Conversational and example-heavy. Makes complex topics accessible.' },
    { id: 'academic_accessible', name: 'Academic & Precise', desc: 'Formal, structured, and authoritative.' },
    { id: 'direct_mentor', name: 'Direct Mentor', desc: 'Clear guidance without unnecessary elaboration.' },
  ],
  creator: [
    { id: 'relatable', name: 'Relatable & Funny', desc: 'Casual, honest, connects through humor and real stories.' },
    { id: 'motivational', name: 'Motivational', desc: 'Energetic and inspiring. Pushes audience to take action.' },
    { id: 'opinion_bold', name: 'Opinion & Bold', desc: 'Takes strong stances. Not afraid to challenge norms.' },
    { id: 'aesthetic', name: 'Aesthetic & Lifestyle', desc: 'Visual-first, curated, elegant.' },
  ],
}

export default function CreateCharacterPage() {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [authToken, setAuthToken] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)

  const [step, setStep] = useState<Step>('type')
  const [characterType, setCharacterType] = useState<CharacterType | null>(null)

  const [form, setForm] = useState({
    name: '',
    domain: '',
    gender: '',
    age_range: '',
    nationality: 'Indian',
    nationality_custom: '',
    style_preset: '',
  })

  const [imageHistory, setImageHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState<number>(-1)
  const previewImageUrl = historyIndex >= 0 ? imageHistory[historyIndex] : null
  const [previewMode, setPreviewMode] = useState<'generated' | 'uploaded'>('generated')
  const [editPrompt, setEditPrompt] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [uploadedPreviewUrl, setUploadedPreviewUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [validationError, setValidationError] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.replace('/login'); return }
      setAuthToken(session.access_token)
      setAuthLoading(false)
    })
  }, [router])

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  function handleTypeSelect(type: CharacterType) {
    setCharacterType(type)
    setForm((prev) => ({ ...prev, style_preset: '' }))
    setStep('form')
  }

  function validateForm(): string | null {
    if (!form.name.trim()) return 'Character name is required.'
    if (!form.gender) return 'Gender is required.'
    if (!form.age_range) return 'Age range is required.'
    if (!form.style_preset) return 'Communication style is required.'
    if (characterType === 'educator' && !form.domain.trim()) return 'Domain / Expertise is required.'
    if (characterType === 'creator' && !form.domain.trim()) return 'Niche is required.'
    return null
  }

  function handleFormNext() {
    const err = validateForm()
    if (err) { setValidationError(err); return }
    setValidationError(null)
    setStep('preview')
  }

  function switchTab(mode: 'generated' | 'uploaded') {
    if (mode === previewMode) return
    setPreviewMode(mode)
    setImageHistory([])
    setHistoryIndex(-1)
    setUploadedFile(null)
    if (uploadedPreviewUrl) { URL.revokeObjectURL(uploadedPreviewUrl); setUploadedPreviewUrl(null) }
  }

  async function handleGeneratePortrait() {
    if (!authToken) return
    setPreviewLoading(true)
    setError(null)
    try {
      const res = await fetch(`${WORKER_URL}/api/characters/preview-portrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          character_type: characterType,
          name: form.name,
          domain: form.domain,
          gender: form.gender,
          age_range: form.age_range,
          nationality: form.nationality === 'Other' ? form.nationality_custom : form.nationality,
          style_preset: form.style_preset,
        }),
      })
      const data = await res.json() as { image_url?: string; error?: string }
      if (!res.ok || !data.image_url) throw new Error(data.error ?? 'Failed to generate portrait')
      const newImageUrl = data.image_url
      setImageHistory(prev => {
        const trimmed = prev.slice(0, historyIndex + 1)
        return [...trimmed, newImageUrl]
      })
      setHistoryIndex(prev => prev + 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate portrait')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleEditPortrait() {
    if (!authToken || !previewImageUrl || !editPrompt.trim()) return
    setPreviewLoading(true)
    setError(null)
    try {
      const res = await fetch(`${WORKER_URL}/api/characters/edit-portrait`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({ current_image_url: previewImageUrl, edit_prompt: editPrompt }),
      })
      const data = await res.json() as { image_url?: string; error?: string }
      if (!res.ok || !data.image_url) throw new Error(data.error ?? 'Failed to edit portrait')
      const newImageUrl = data.image_url
      setImageHistory(prev => {
        const trimmed = prev.slice(0, historyIndex + 1)
        return [...trimmed, newImageUrl]
      })
      setHistoryIndex(prev => prev + 1)
      setEditPrompt('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to edit portrait')
    } finally {
      setPreviewLoading(false)
    }
  }

  async function handleCreateCharacter(skipPhoto: boolean) {
    if (!authToken) return
    setSubmitting(true)
    setError(null)

    const nationality =
      form.nationality === 'Other' ? form.nationality_custom || 'Other' : form.nationality

    try {
      const res = await fetch(`${WORKER_URL}/api/characters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body: JSON.stringify({
          name: form.name,
          domain: form.domain || '',
          gender: form.gender || 'neutral',
          age_range: form.age_range || '30s',
          nationality,
          style_preset: form.style_preset,
          character_type: characterType,
        }),
      })
      const json = await res.json() as { data?: { id: string }; error?: string }
      if (!res.ok) { setError(json.error ?? 'Failed to create character.'); setSubmitting(false); return }

      const characterId = json.data?.id
      if (!characterId) { setError('Failed to create character.'); setSubmitting(false); return }

      if (!skipPhoto) {
        if (previewImageUrl && previewMode === 'generated') {
          try {
            const imgRes = await fetch(previewImageUrl)
            const blob = await imgRes.blob()
            const fd = new FormData()
            fd.append('files', blob, 'reference.jpg')
            fd.append('pose_types', JSON.stringify(['front']))
            await fetch(`${WORKER_URL}/api/characters/${characterId}/references`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${authToken}` },
              body: fd,
            })
          } catch { /* continue anyway */ }
        }

        if (uploadedFile && previewMode === 'uploaded') {
          try {
            const fd = new FormData()
            fd.append('files', uploadedFile)
            fd.append('pose_types', JSON.stringify(['front']))
            await fetch(`${WORKER_URL}/api/characters/${characterId}/references`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${authToken}` },
              body: fd,
            })
          } catch { /* continue anyway */ }
        }
      }

      router.push(`/dashboard/chat?id=${characterId}`)
    } catch {
      setError('Network error. Please try again.')
      setSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-[#71717a]">Loading…</p>
      </div>
    )
  }

  const backAction =
    step === 'type'
      ? () => router.push('/dashboard')
      : step === 'form'
      ? () => setStep('type')
      : () => setStep('form')

  const presets = characterType ? STYLE_PRESETS[characterType] : []

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#262626] bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={backAction}
            className="text-sm text-[#a1a1aa] transition-colors hover:text-white"
          >
            ← Back
          </button>
          <span className="text-sm font-semibold text-white">PersonalityOS</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">

        {/* ── STEP 1: Type Selection ─────────────────────────────────── */}
        {step === 'type' && (
          <div>
            <div className="mb-8">
              <h1 className="text-2xl font-semibold tracking-tight text-white">What best describes you?</h1>
              <p className="mt-1 text-sm text-[#a1a1aa]">This shapes your character's voice and content style.</p>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {(
                [
                  { type: 'educator' as const, icon: '🎓', title: 'Educator / Coach', desc: 'Teachers, UPSC educators, skill coaches, domain experts who share knowledge' },
                  { type: 'creator' as const, icon: '✨', title: 'Creator / Brand', desc: 'Personal brand builders, influencers, lifestyle creators, opinion leaders' },
                ] as const
              ).map(({ type, icon, title, desc }) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleTypeSelect(type)}
                  className="flex flex-col items-start gap-3 rounded-xl border border-[#262626] bg-[#141414] p-6 text-left transition-colors hover:border-[#404040] hover:bg-[#1a1a1a]"
                >
                  <span className="text-4xl">{icon}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{title}</p>
                    <p className="mt-1 text-xs text-[#71717a]">{desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Form ───────────────────────────────────────────── */}
        {step === 'form' && characterType && (
          <div className="space-y-8">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {characterType === 'educator' && 'Create your Educator character'}
              {characterType === 'creator' && 'Create your Creator character'}
            </h1>

            {/* Character name */}
            <section>
              <label className="mb-2 block text-sm font-medium text-white">Character Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setField('name', e.target.value)}
                placeholder="e.g. Arjun"
                className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-white placeholder:text-[#71717a] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </section>

            {/* Educator: Domain */}
            {characterType === 'educator' && (
              <section>
                <label className="mb-2 block text-sm font-medium text-white">Domain / Expertise</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => setField('domain', e.target.value)}
                  placeholder="e.g. UPSC Civil Services"
                  className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-white placeholder:text-[#71717a] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {EDUCATOR_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setField('domain', chip === 'Other' ? '' : chip)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        form.domain === chip
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border-[#262626] bg-[#141414] text-[#a1a1aa] hover:border-[#404040] hover:text-white'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Creator: Niche */}
            {characterType === 'creator' && (
              <section>
                <label className="mb-2 block text-sm font-medium text-white">Your niche</label>
                <input
                  type="text"
                  value={form.domain}
                  onChange={(e) => setField('domain', e.target.value)}
                  placeholder="e.g. Startup founder / Tech"
                  className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-white placeholder:text-[#71717a] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                <div className="mt-3 flex flex-wrap gap-2">
                  {CREATOR_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setField('domain', chip === 'Other' ? '' : chip)}
                      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        form.domain === chip
                          ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                          : 'border-[#262626] bg-[#141414] text-[#a1a1aa] hover:border-[#404040] hover:text-white'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </section>
            )}

            {/* Reseller section removed */}

            {/* Gender */}
            <section>
              <p className="mb-3 text-sm font-medium text-white">Gender</p>
              <div className="grid grid-cols-3 gap-3">
                {['Male', 'Female', 'Neutral'].map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setField('gender', g.toLowerCase())}
                    className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      form.gender === g.toLowerCase()
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-[#262626] bg-[#141414] text-[#a1a1aa] hover:border-[#404040] hover:text-white'
                    }`}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </section>

            {/* Age Range */}
            <section>
              <p className="mb-3 text-sm font-medium text-white">Age Range</p>
              <div className="grid grid-cols-3 gap-3">
                {['20s', '30s', '40s+'].map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setField('age_range', a)}
                    className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      form.age_range === a
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-[#262626] bg-[#141414] text-[#a1a1aa] hover:border-[#404040] hover:text-white'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </section>

            {/* Nationality */}
            <section>
              <p className="mb-3 text-sm font-medium text-white">Nationality</p>
              <div className="grid grid-cols-2 gap-3">
                {['Indian', 'Other'].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setField('nationality', n)}
                    className={`rounded-lg border px-4 py-3 text-left text-sm font-medium transition-colors ${
                      form.nationality === n
                        ? 'border-indigo-500 bg-indigo-500/10 text-white'
                        : 'border-[#262626] bg-[#141414] text-[#a1a1aa] hover:border-[#404040] hover:text-white'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              {form.nationality === 'Other' && (
                <input
                  type="text"
                  value={form.nationality_custom}
                  onChange={(e) => setField('nationality_custom', e.target.value)}
                  placeholder="Enter nationality"
                  className="mt-3 w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-white placeholder:text-[#71717a] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              )}
            </section>

            {/* Communication Style */}
            <section>
              <p className="mb-3 text-sm font-medium text-white">Communication Style</p>
              <div className="space-y-3">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setField('style_preset', preset.id)}
                    className={`w-full rounded-lg border p-4 text-left transition-colors ${
                      form.style_preset === preset.id
                        ? 'border-indigo-500 bg-indigo-500/10'
                        : 'border-[#262626] bg-[#141414] hover:border-[#404040]'
                    }`}
                  >
                    <p className={`text-sm font-medium ${form.style_preset === preset.id ? 'text-white' : 'text-[#a1a1aa]'}`}>
                      {preset.name}
                    </p>
                    <p className="mt-0.5 text-xs text-[#71717a]">{preset.desc}</p>
                  </button>
                ))}
              </div>
            </section>

            {validationError && (
              <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
                {validationError}
              </p>
            )}

            <button
              type="button"
              onClick={handleFormNext}
              className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
            >
              Next →
            </button>
          </div>
        )}

        {/* ── STEP 3: Preview ────────────────────────────────────────── */}
        {step === 'preview' && (
          <div className="space-y-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-white">Your reference photo</h1>
              <p className="mt-1 text-sm text-[#a1a1aa]">
                Used for consistent image generation. Change anytime in Settings.
              </p>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 rounded-lg border border-[#262626] bg-[#141414] p-1">
              <button
                type="button"
                onClick={() => switchTab('generated')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  previewMode === 'generated' ? 'bg-[#262626] text-white' : 'text-[#a1a1aa] hover:text-white'
                }`}
              >
                ✨ Generate from DNA
              </button>
              <button
                type="button"
                onClick={() => switchTab('uploaded')}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                  previewMode === 'uploaded' ? 'bg-[#262626] text-white' : 'text-[#a1a1aa] hover:text-white'
                }`}
              >
                📷 Upload a photo
              </button>
            </div>

            {/* Generate tab */}
            {previewMode === 'generated' && (
              <div>
                {previewLoading ? (
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-[#262626] bg-[#141414] py-16">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-400" />
                    <p className="text-sm text-[#a1a1aa]">Generating your character…</p>
                  </div>
                ) : previewImageUrl ? (
                  <div className="space-y-4">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewImageUrl}
                      alt="Generated portrait"
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    {imageHistory.length > 1 && (
                      <div className="flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setHistoryIndex(prev => prev - 1)}
                          disabled={historyIndex === 0}
                          className="text-xs text-[#a1a1aa] transition-colors hover:text-white disabled:opacity-30"
                        >
                          ← Previous
                        </button>
                        <span className="text-xs text-[#a1a1aa]">
                          Version {historyIndex + 1} of {imageHistory.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => setHistoryIndex(prev => prev + 1)}
                          disabled={historyIndex === imageHistory.length - 1}
                          className="text-xs text-[#a1a1aa] transition-colors hover:text-white disabled:opacity-30"
                        >
                          Next →
                        </button>
                      </div>
                    )}
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-white">Edit this image</label>
                      <textarea
                        value={editPrompt}
                        onChange={(e) => setEditPrompt(e.target.value)}
                        rows={3}
                        placeholder={
                          'e.g. Change outfit to a traditional kurta,\nmake the background darker,\nadjust lighting to be warmer,\nmake the smile more confident'
                        }
                        className="w-full resize-none rounded-lg border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-white placeholder:text-[#71717a] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                      <button
                        type="button"
                        onClick={handleEditPortrait}
                        disabled={!editPrompt.trim()}
                        className="rounded-lg bg-[#262626] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#333333] disabled:opacity-40"
                      >
                        Apply Edit →
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center rounded-xl border border-[#262626] bg-[#141414] py-16">
                    <button
                      type="button"
                      onClick={handleGeneratePortrait}
                      className="rounded-lg bg-indigo-600 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500"
                    >
                      ✨ Generate my character →
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Upload tab */}
            {previewMode === 'uploaded' && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full rounded-xl border-2 border-dashed border-[#262626] bg-[#141414] p-10 transition-colors hover:border-[#404040]"
                >
                  {uploadedPreviewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={uploadedPreviewUrl}
                      alt="Uploaded preview"
                      className="mx-auto aspect-square max-w-xs rounded-lg object-cover"
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-3">
                      <Upload size={24} className="text-[#71717a]" />
                      <div className="text-center">
                        <p className="text-sm text-[#a1a1aa]">Upload Photo</p>
                        <p className="mt-0.5 text-xs text-[#71717a]">JPEG or PNG, max 10MB</p>
                      </div>
                    </div>
                  )}
                </button>
                <p className="text-xs text-[#71717a]">
                  Photo editing available after character creation in Settings
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (uploadedPreviewUrl) URL.revokeObjectURL(uploadedPreviewUrl)
                    setUploadedFile(file)
                    setUploadedPreviewUrl(URL.createObjectURL(file))
                    e.target.value = ''
                  }}
                />
              </div>
            )}

            {error && (
              <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
                {error}
              </p>
            )}

            {/* Primary CTA — only when image is ready */}
            {(previewImageUrl || uploadedFile) && (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => handleCreateCharacter(false)}
                  disabled={submitting}
                  className="w-full rounded-lg bg-indigo-600 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                >
                  {submitting ? 'Creating…' : '✓ Use this — Create Character'}
                </button>
                <button
                  type="button"
                  onClick={() => handleCreateCharacter(true)}
                  disabled={submitting}
                  className="w-full text-sm text-[#71717a] transition-colors hover:text-white"
                >
                  Skip for now — add photo later in Settings →
                </button>
              </div>
            )}

            {/* Skip link when no image yet */}
            {!previewImageUrl && !uploadedFile && (
              <button
                type="button"
                onClick={() => handleCreateCharacter(true)}
                disabled={submitting}
                className="w-full text-sm text-[#71717a] transition-colors hover:text-white"
              >
                {submitting ? 'Creating…' : 'Skip for now — add photo later in Settings →'}
              </button>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
