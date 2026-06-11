'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

const DOMAIN_CHIPS = ['UPSC', 'Finance', 'Startup', 'Coaching', 'History', 'Ethics', 'Science', 'Law', 'Other']

const STYLE_PRESETS = [
  {
    id: 'engaging_explainer',
    name: 'Engaging Explainer',
    description: 'Conversational and example-heavy. Makes complex topics accessible.',
  },
  {
    id: 'academic_accessible',
    name: 'Academic Accessible',
    description: 'Formal, precise, and structured with academic rigor.',
  },
  {
    id: 'direct_mentor',
    name: 'Direct Mentor',
    description: 'Authoritative and direct. Clear guidance without unnecessary elaboration.',
  },
]

type FormState = {
  name: string
  domain: string
  gender: string
  age_range: string
  nationality: string
  nationality_custom: string
  style_preset: string
}

function SelectionCard({
  label,
  selected,
  onClick,
}: {
  label: string
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg border px-4 py-3 text-sm font-medium transition-colors text-left ${
        selected
          ? 'border-indigo-500 bg-indigo-500/10 text-white'
          : 'border-[#262626] bg-[#141414] text-[#a1a1aa] hover:border-[#404040] hover:text-white'
      }`}
    >
      {label}
    </button>
  )
}

export default function CreateCharacterPage() {
  const router = useRouter()
  const [form, setForm] = useState<FormState>({
    name: '',
    domain: '',
    gender: '',
    age_range: '',
    nationality: 'Indian',
    nationality_custom: '',
    style_preset: 'engaging_explainer',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        router.replace('/login')
        return
      }
      setAuthChecked(true)
    })
  }, [router])

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const name = form.name.trim()
    const domain = form.domain.trim()
    if (!name) return setError('Character name is required.')
    if (!domain) return setError('Domain is required.')

    const nationality =
      form.nationality === 'Other' ? form.nationality_custom.trim() || 'Other' : form.nationality

    setSubmitting(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const workerUrl = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'
      const res = await fetch(`${workerUrl}/api/characters`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          name,
          domain,
          gender: form.gender || 'neutral',
          age_range: form.age_range || '30s',
          nationality,
          style_preset: form.style_preset,
        }),
      })

      const json = await res.json() as { data?: unknown; error?: string }
      if (!res.ok) { setError(json.error ?? 'Failed to create character.'); return }

      router.push('/dashboard')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-[#71717a]">Loading…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#262626] bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => router.push('/dashboard')}
            className="text-sm text-[#a1a1aa] hover:text-white transition-colors"
          >
            ← Back
          </button>
          <span className="text-sm font-semibold text-white">PersonalityOS</span>
          <div className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-white">Create a Character</h1>
          <p className="mt-1 text-sm text-[#a1a1aa]">
            Define your AI character's identity. This becomes the DNA for all content generation.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
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

          <section>
            <label className="mb-2 block text-sm font-medium text-white">Domain / Expertise</label>
            <input
              type="text"
              value={form.domain}
              onChange={(e) => setField('domain', e.target.value)}
              placeholder="e.g. UPSC — Indian Polity & Constitutional Law"
              className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-white placeholder:text-[#71717a] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {DOMAIN_CHIPS.map((chip) => (
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

          <section>
            <p className="mb-3 text-sm font-medium text-white">Gender</p>
            <div className="grid grid-cols-3 gap-3">
              {['Male', 'Female', 'Neutral'].map((g) => (
                <SelectionCard
                  key={g}
                  label={g}
                  selected={form.gender === g.toLowerCase()}
                  onClick={() => setField('gender', g.toLowerCase())}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm font-medium text-white">Age Range</p>
            <div className="grid grid-cols-3 gap-3">
              {['20s', '30s', '40s+'].map((a) => (
                <SelectionCard
                  key={a}
                  label={a}
                  selected={form.age_range === a}
                  onClick={() => setField('age_range', a)}
                />
              ))}
            </div>
          </section>

          <section>
            <p className="mb-3 text-sm font-medium text-white">Nationality</p>
            <div className="grid grid-cols-2 gap-3">
              <SelectionCard
                label="Indian"
                selected={form.nationality === 'Indian'}
                onClick={() => setField('nationality', 'Indian')}
              />
              <SelectionCard
                label="Other"
                selected={form.nationality === 'Other'}
                onClick={() => setField('nationality', 'Other')}
              />
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

          <section>
            <p className="mb-3 text-sm font-medium text-white">Communication Style</p>
            <div className="space-y-3">
              {STYLE_PRESETS.map((preset) => (
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
                  <p className="mt-0.5 text-xs text-[#71717a]">{preset.description}</p>
                </button>
              ))}
            </div>
          </section>

          {error && (
            <p className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-sm text-red-400">
              {error}
            </p>
          )}

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
            size="lg"
          >
            {submitting ? 'Creating Character…' : 'Create Character'}
          </Button>
        </form>
      </main>
    </div>
  )
}
