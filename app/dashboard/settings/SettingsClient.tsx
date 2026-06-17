'use client'

import { useState, useEffect, useRef } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

const POSE_LABELS: Record<string, string> = {
  front: 'Front Portrait',
  side: 'Side Profile',
  angled: 'Angled',
  backside: 'Backside',
  expertise_specific: 'Expertise Specific',
  other: 'Other',
}

type ReferenceImage = { url: string; pose_type: string; is_primary: boolean }

type PromptDna = {
  style_modifiers?: string[]
  negative_prompt?: string
  color_palette?: string
  aspect_preferences?: Record<string, string>
  provider_overrides?: { muapi?: { model?: string; steps?: number } }
}

type Character = {
  id: string
  name: string
  domain: string
  gender?: string
  age_range?: string
  nationality?: string
  style_preset?: string
  reference_images_ready: number
  reference_image_urls?: string
  prompt_dna?: string
}

type FileEntry = { file: File; previewUrl: string; poseType: string }

function CardSelector({
  options,
  value,
  onChange,
}: {
  options: { value: string; label: string; desc?: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`rounded-lg border px-3 py-2 text-left transition-colors ${
            value === opt.value
              ? 'border-indigo-500 bg-indigo-500/15 text-white'
              : 'border-[#262626] bg-[#141414] text-[#a1a1aa] hover:border-[#404040] hover:text-white'
          }`}
        >
          <div className="text-sm font-medium">{opt.label}</div>
          {opt.desc && <div className="mt-0.5 text-xs text-[#71717a]">{opt.desc}</div>}
        </button>
      ))}
    </div>
  )
}

export default function SettingsClient() {
  const searchParams = useSearchParams()
  const characterId = searchParams.get('id')
  const router = useRouter()

  const [character, setCharacter] = useState<Character | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  // ── Section 1: Identity ────────────────────────────────────────────────────
  const [identityName, setIdentityName] = useState('')
  const [identityDomain, setIdentityDomain] = useState('')
  const [identityGender, setIdentityGender] = useState('')
  const [identityAgeRange, setIdentityAgeRange] = useState('')
  const [identityNationality, setIdentityNationality] = useState('')
  const [identityStylePreset, setIdentityStylePreset] = useState('')
  const [identitySaving, setIdentitySaving] = useState(false)
  const [identitySaved, setIdentitySaved] = useState(false)
  const [identityError, setIdentityError] = useState<string | null>(null)
  const [originalIdentity, setOriginalIdentity] = useState({ name: '', domain: '', gender: '', age_range: '', nationality: '', style_preset: '' })

  // ── Section 2: Reference Images ────────────────────────────────────────────
  const [files, setFiles] = useState<FileEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploadSaved, setUploadSaved] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Section 3: Style Controls ──────────────────────────────────────────────
  const [styleColorPalette, setStyleColorPalette] = useState('')
  const [styleModel, setStyleModel] = useState('nano-banana-edit')
  const [styleSaving, setStyleSaving] = useState(false)
  const [styleSaved, setStyleSaved] = useState(false)
  const [styleError, setStyleError] = useState<string | null>(null)
  const [originalStyle, setOriginalStyle] = useState({ colorPalette: '', styleModel: 'nano-banana-edit' })

  const [modalImageUrl, setModalImageUrl] = useState<string | null>(null)

  // ── Danger Zone ────────────────────────────────────────────────────────────
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [confirmName,     setConfirmName]     = useState('')
  const [deleting,        setDeleting]        = useState(false)
  const [deleteError,     setDeleteError]     = useState<string | null>(null)

  useEffect(() => {
    if (!characterId) { setLoadError('No character ID.'); setLoading(false); return }
    const supabase = createClient()
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      setToken(session.access_token)
      try {
        const res = await fetch(`${WORKER_URL}/api/characters/${characterId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json() as { data?: Character; error?: string }
        if (!res.ok || !json.data) { setLoadError(json.error ?? 'Character not found.'); return }
        const c = json.data
        setCharacter(c)
        setIdentityName(c.name ?? '')
        setIdentityDomain(c.domain ?? '')
        setIdentityGender(c.gender ?? '')
        setIdentityAgeRange(c.age_range ?? '')
        setIdentityNationality(c.nationality ?? '')
        setIdentityStylePreset(c.style_preset ?? '')
        setOriginalIdentity({
          name: c.name ?? '',
          domain: c.domain ?? '',
          gender: c.gender ?? '',
          age_range: c.age_range ?? '',
          nationality: c.nationality ?? '',
          style_preset: c.style_preset ?? '',
        })
        try {
          const dna: PromptDna = JSON.parse(c.prompt_dna ?? '{}')
          const loadedPalette = dna.color_palette ?? ''
          const loadedModel   = dna.provider_overrides?.muapi?.model ?? 'nano-banana-edit'
          setStyleColorPalette(loadedPalette)
          setStyleModel(loadedModel)
          setOriginalStyle({ colorPalette: loadedPalette, styleModel: loadedModel })
        } catch { /* leave defaults */ }
      } catch {
        setLoadError('Failed to load character.')
      } finally {
        setLoading(false)
      }
    })
  }, [characterId, router])

  useEffect(() => {
    return () => { files.forEach(f => URL.revokeObjectURL(f.previewUrl)) }
  }, [files])

  async function saveIdentity() {
    if (!token || !characterId) return
    setIdentitySaving(true)
    setIdentityError(null)
    setIdentitySaved(false)
    try {
      const res = await fetch(`${WORKER_URL}/api/characters/${characterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: identityName,
          domain: identityDomain,
          gender: identityGender,
          age_range: identityAgeRange,
          nationality: identityNationality,
          style_preset: identityStylePreset,
        }),
      })
      const json = await res.json() as { data?: Character; error?: string }
      if (!res.ok) { setIdentityError(json.error ?? 'Save failed.'); return }
      if (json.data) setCharacter(json.data)
      setOriginalIdentity({
        name: identityName,
        domain: identityDomain,
        gender: identityGender,
        age_range: identityAgeRange,
        nationality: identityNationality,
        style_preset: identityStylePreset,
      })
      setIdentitySaved(true)
      setTimeout(() => setIdentitySaved(false), 3000)
    } catch {
      setIdentityError('Network error.')
    } finally {
      setIdentitySaving(false)
    }
  }

  function addFiles(incoming: File[]) {
    setUploadError(null)
    const valid: File[] = []
    for (const f of incoming) {
      if (!['image/jpeg', 'image/png'].includes(f.type)) {
        setUploadError(`"${f.name}" is not a JPEG or PNG.`); continue
      }
      if (f.size > 10 * 1024 * 1024) {
        setUploadError(`"${f.name}" exceeds 10 MB.`); continue
      }
      valid.push(f)
    }
    const entries: FileEntry[] = valid.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      poseType: 'front',
    }))
    setFiles(prev => {
      const next = [...prev, ...entries]
      if (next.length > 5) {
        next.slice(5).forEach(e => URL.revokeObjectURL(e.previewUrl))
        setUploadError('Maximum 5 photos allowed.')
        return next.slice(0, 5)
      }
      return next
    })
  }

  async function saveReferenceImages() {
    if (files.length === 0) { setUploadError('Add at least one photo.'); return }
    if (!token || !characterId) return
    setUploading(true)
    setUploadError(null)
    setUploadSaved(false)
    try {
      const formData = new FormData()
      const poseTypes: string[] = []
      files.forEach(entry => {
        formData.append('files', entry.file)
        poseTypes.push(entry.poseType)
      })
      formData.append('pose_types', JSON.stringify(poseTypes))
      const res = await fetch(`${WORKER_URL}/api/characters/${characterId}/references`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const json = await res.json() as { data?: Character; error?: string }
      if (!res.ok) { setUploadError(json.error ?? 'Upload failed.'); return }
      if (json.data) setCharacter(json.data)
      setUploadSaved(true)
      setFiles([])
    } catch {
      setUploadError('Network error.')
    } finally {
      setUploading(false)
    }
  }

  async function saveStyle() {
    if (!token || !characterId || !character) return
    setStyleSaving(true)
    setStyleError(null)
    setStyleSaved(false)
    try {
      let dna: PromptDna = {}
      try { dna = JSON.parse(character.prompt_dna ?? '{}') } catch { /* use empty */ }
      dna.color_palette = styleColorPalette
      dna.provider_overrides = {
        ...dna.provider_overrides,
        muapi: { ...(dna.provider_overrides?.muapi ?? {}), model: styleModel },
      }
      const res = await fetch(`${WORKER_URL}/api/characters/${characterId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ prompt_dna: JSON.stringify(dna) }),
      })
      const json = await res.json() as { data?: Character; error?: string }
      if (!res.ok) { setStyleError(json.error ?? 'Save failed.'); return }
      if (json.data) setCharacter(json.data)
      setOriginalStyle({ colorPalette: styleColorPalette, styleModel })
      setStyleSaved(true)
      setTimeout(() => setStyleSaved(false), 3000)
    } catch {
      setStyleError('Network error.')
    } finally {
      setStyleSaving(false)
    }
  }

  async function deleteCharacter() {
    if (!token || !characterId) return
    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`${WORKER_URL}/api/characters/${characterId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      })
      const json = await res.json() as { data?: { deleted: boolean }; error?: string }
      if (!res.ok) { setDeleteError(json.error ?? 'Delete failed.'); return }
      router.push('/dashboard')
    } catch {
      setDeleteError('Network error.')
    } finally {
      setDeleting(false)
    }
  }

  const identityDirty =
    identityName       !== originalIdentity.name        ||
    identityDomain     !== originalIdentity.domain      ||
    identityGender     !== originalIdentity.gender      ||
    identityAgeRange   !== originalIdentity.age_range   ||
    identityNationality !== originalIdentity.nationality ||
    identityStylePreset !== originalIdentity.style_preset

  const styleDirty =
    styleColorPalette !== originalStyle.colorPalette ||
    styleModel        !== originalStyle.styleModel

  // Parse existing reference images for thumbnails
  let existingRefs: ReferenceImage[] = []
  if (character?.reference_image_urls) {
    try { existingRefs = JSON.parse(character.reference_image_urls) } catch { /* empty */ }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="w-64 space-y-3 animate-pulse">
          <div className="h-5 rounded bg-[#262626]" />
          <div className="h-3 rounded bg-[#1f1f1f]" />
        </div>
      </div>
    )
  }

  if (loadError || !character) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        <p className="text-sm text-red-400">{loadError ?? 'Character not found.'}</p>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="bg-black text-white border-white hover:bg-zinc-900 hover:text-white hover:border-white">
            ← Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#262626] bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <Link
            href={`/dashboard/chat?id=${character.id}`}
            className="shrink-0 text-[#71717a] transition-colors hover:text-white"
            aria-label="Back to chat"
          >
            ←
          </Link>
          <h1 className="truncate text-base font-semibold text-white">
            {character.name} — Edit Character
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-10 px-4 py-8">

        {/* ── Section 1: Reference Photos ─────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-white">Reference Photos</h2>
          <p className="mb-4 text-sm text-[#71717a]">
            Used to keep {character.name}&apos;s appearance consistent across images.
          </p>

          {/* Photos row: existing thumbnails + add card */}
          <div className="mb-4">
            <div className="flex flex-row flex-wrap gap-3">
              {existingRefs.map((ref, i) => (
                <div key={i} className="relative flex-shrink-0">
                  <div
                    className="relative cursor-pointer group"
                    onClick={() => setModalImageUrl(`${WORKER_URL}/files/${ref.url}`)}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`${WORKER_URL}/files/${ref.url}`}
                      alt={`Reference ${i + 1}`}
                      className="h-32 w-32 rounded-lg border border-zinc-700 object-cover object-top"
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20
                                    rounded-lg transition-colors" />
                  </div>
                  {ref.is_primary && (
                    <span className="absolute bottom-1 left-1 rounded bg-indigo-600/80 px-1 py-0.5 text-[9px] font-medium text-white">
                      Primary
                    </span>
                  )}
                </div>
              ))}
              {files.length < 5 && (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="h-32 w-32 rounded-lg border-2 border-dashed border-zinc-700 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-indigo-500 hover:bg-indigo-500/5 transition-all flex-shrink-0"
                >
                  <span className="text-2xl text-zinc-600">+</span>
                  <span className="text-xs text-zinc-600">Add photo</span>
                </div>
              )}
            </div>
            {existingRefs.length > 0 && (
              <p className="mt-2 text-xs text-[#555]">Uploading new photos will replace these.</p>
            )}
          </div>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={e => {
              if (e.target.files) addFiles(Array.from(e.target.files))
              e.target.value = ''
            }}
          />

          {uploadSaved && (
            <div className="mb-4 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <span className="text-green-400">✓</span>
              <p className="text-sm font-medium text-green-300">
                Photos saved. {character.name} is ready to generate.
              </p>
            </div>
          )}

          {files.length > 0 && (
            <div className="mb-4 grid gap-3 sm:grid-cols-2">
              {files.map((entry, i) => (
                <div key={i} className="overflow-hidden rounded-xl border border-[#262626] bg-[#141414]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.previewUrl} alt={`Preview ${i + 1}`} className="h-40 w-full object-cover" />
                  <div className="flex items-center gap-2 p-3">
                    <select
                      value={entry.poseType}
                      onChange={e => setFiles(prev => prev.map((f, j) => j === i ? { ...f, poseType: e.target.value } : f))}
                      className="flex-1 rounded-md border border-[#262626] bg-[#0a0a0a] px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {Object.entries(POSE_LABELS).map(([v, l]) => (
                        <option key={v} value={v}>{l}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setFiles(prev => {
                        URL.revokeObjectURL(prev[i].previewUrl)
                        return prev.filter((_, j) => j !== i)
                      })}
                      className="rounded-md p-1.5 text-[#71717a] transition-colors hover:bg-[#262626] hover:text-white"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {uploadError && (
            <div className="mb-4 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2">
              <p className="text-sm text-red-400">{uploadError}</p>
            </div>
          )}

          <Button
            onClick={saveReferenceImages}
            disabled={uploading || files.length === 0}
            className="bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : 'Save Reference Photos'}
          </Button>
        </section>

        <hr className="border-[#1f1f1f]" />

        {/* ── Section 2: Identity ─────────────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-white">Identity</h2>
          <p className="mb-6 text-sm text-[#71717a]">
            Core details that shape {character.name}&apos;s voice and visual style.
          </p>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Name</label>
                <input
                  value={identityName}
                  onChange={e => setIdentityName(e.target.value)}
                  className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white placeholder-[#71717a] outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Domain / Profession</label>
                <input
                  value={identityDomain}
                  onChange={e => setIdentityDomain(e.target.value)}
                  className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white placeholder-[#71717a] outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-[#a1a1aa]">Gender</label>
              <CardSelector
                value={identityGender}
                onChange={setIdentityGender}
                options={[
                  { value: 'male',       label: 'Male'       },
                  { value: 'female',     label: 'Female'     },
                  { value: 'non-binary', label: 'Non-binary' },
                ]}
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-[#a1a1aa]">Age Range</label>
              <CardSelector
                value={identityAgeRange}
                onChange={setIdentityAgeRange}
                options={[
                  { value: '20s',  label: '20s'  },
                  { value: '30s',  label: '30s'  },
                  { value: '40s+', label: '40s+' },
                ]}
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Nationality</label>
              <input
                value={identityNationality}
                onChange={e => setIdentityNationality(e.target.value)}
                placeholder="e.g. Indian, American, British"
                className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white placeholder-[#71717a] outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-medium text-[#a1a1aa]">Content Style</label>
              <CardSelector
                value={identityStylePreset}
                onChange={setIdentityStylePreset}
                options={[
                  { value: 'academic_accessible', label: 'Academic',  desc: 'Formal, structured, precise'       },
                  { value: 'engaging_explainer',  label: 'Engaging',  desc: 'Conversational, example-heavy'     },
                  { value: 'direct_mentor',       label: 'Direct',    desc: 'Authoritative, brief, no-nonsense' },
                ]}
              />
            </div>
          </div>

          {identityError && (
            <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2">
              <p className="text-sm text-red-400">{identityError}</p>
            </div>
          )}
          <div className="mt-5 flex items-center gap-3">
            <Button
              disabled={!identityDirty || identitySaving}
              onClick={saveIdentity}
              className={`bg-indigo-600 text-white hover:bg-indigo-500 ${(!identityDirty || identitySaving) ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {identitySaving ? 'Saving…' : 'Save Identity'}
            </Button>
            {identitySaved && (
              <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center animate-in fade-in duration-200">
                <Check className="h-3.5 w-3.5 text-green-500" />
              </div>
            )}
          </div>
        </section>

        <hr className="border-[#1f1f1f]" />

        {/* ── Section 3: Style Controls ───────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-lg font-semibold text-white">Style Controls</h2>
          <p className="mb-6 text-sm text-[#71717a]">Fine-tune the visual output for {character.name}.</p>

          <div className="space-y-5">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Color Palette</label>
              <input
                value={styleColorPalette}
                onChange={e => setStyleColorPalette(e.target.value)}
                placeholder="e.g. warm professional tones, natural lighting"
                className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white placeholder-[#71717a] outline-none focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">Default Model</label>
              <select
                value={styleModel}
                onChange={e => setStyleModel(e.target.value)}
                className="w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="nano-banana-edit">nano-banana-edit — with reference image (recommended)</option>
                <option value="flux-dev">flux-dev — high quality, no reference</option>
                <option value="flux-schnell">flux-schnell — faster, lighter</option>
              </select>
            </div>
          </div>

          {styleError && (
            <div className="mt-4 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2">
              <p className="text-sm text-red-400">{styleError}</p>
            </div>
          )}
          <div className="mt-5 flex items-center gap-3">
            <Button
              disabled={!styleDirty || styleSaving}
              onClick={saveStyle}
              className={`bg-indigo-600 text-white hover:bg-indigo-500 ${(!styleDirty || styleSaving) ? 'opacity-40 cursor-not-allowed' : ''}`}
            >
              {styleSaving ? 'Saving…' : 'Save Style'}
            </Button>
            {styleSaved && (
              <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center animate-in fade-in duration-200">
                <Check className="h-3.5 w-3.5 text-green-500" />
              </div>
            )}
          </div>
        </section>

        <hr className="border-[#1f1f1f]" />

        {/* ── Danger Zone ─────────────────────────────────────────────────── */}
        <section>
          <div className="rounded-lg border border-red-900/50 p-6">
            <p className="mb-4 text-sm font-medium text-red-400">Danger Zone</p>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-white">Delete this character</p>
                <p className="mt-1 text-xs text-[#71717a]">
                  Permanently deletes this character and all their generations, images, and templates.
                  This cannot be undone.
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => { setShowDeleteModal(true); setDeleteError(null); setConfirmName('') }}
                className="shrink-0 border-red-900 bg-transparent text-red-400 hover:bg-red-950/30 text-sm"
              >
                Delete character
              </Button>
            </div>
          </div>
        </section>

        <div className="pb-8" />
      </main>

      {modalImageUrl && (
        <div
          className="fixed inset-0 bg-black/90 z-50
                     flex items-center justify-center p-4"
          onClick={() => setModalImageUrl(null)}>
          <div
            className="relative max-w-lg w-full"
            onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setModalImageUrl(null)}
              className="absolute top-3 right-3 z-10 h-8 w-8
                         rounded-full bg-black/60 border border-white/20
                         text-white flex items-center justify-center
                         hover:bg-black">
              <X className="h-4 w-4" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={modalImageUrl}
              alt="Reference photo"
              className="w-full rounded-xl object-contain max-h-[80vh]"
            />
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-50 bg-black/70">
          <div className="fixed left-1/2 top-1/2 mx-4 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#262626] bg-[#141414] p-6">
            <h2 className="text-lg font-semibold text-white">Delete {character.name}?</h2>
            <div className="mt-3 rounded-lg border border-amber-900/50 bg-amber-950/30 p-3">
              <p className="text-xs text-amber-400">
                This will permanently delete this character and all associated content including
                reference images, generations, and templates.
              </p>
            </div>
            <div className="mt-4">
              <label className="text-sm text-[#a1a1aa]">
                Type <span className="font-medium text-white">{character.name}</span> to confirm:
              </label>
              <input
                value={confirmName}
                onChange={e => setConfirmName(e.target.value)}
                placeholder={character.name}
                className="mt-2 w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2 text-sm text-white placeholder-[#71717a] outline-none focus:border-red-500"
              />
            </div>
            {deleteError && (
              <div className="mt-3 rounded-lg border border-red-900/50 bg-red-950/20 px-3 py-2">
                <p className="text-sm text-red-400">{deleteError}</p>
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setConfirmName(''); setDeleteError(null) }}
                className="text-sm text-[#a1a1aa] transition-colors hover:text-white"
              >
                Cancel
              </button>
              <Button
                onClick={deleteCharacter}
                disabled={confirmName.trim() !== character.name || deleting}
                className={`bg-red-600 text-sm text-white hover:bg-red-500 ${confirmName.trim() !== character.name || deleting ? 'cursor-not-allowed opacity-50' : ''}`}
              >
                {deleting ? 'Deleting…' : 'Delete permanently'}
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
