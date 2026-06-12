'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/browser'

const POSE_LABELS: Record<string, string> = {
  front: 'Front Portrait',
  side: 'Side Profile',
  angled: 'Angled',
  backside: 'Backside',
  expertise_specific: 'Expertise Specific',
  other: 'Other',
}

type FileEntry = {
  file: File
  previewUrl: string
  poseType: string
}

type Character = {
  id: string
  name: string
  domain: string
  reference_images_ready: number
}

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

export default function SettingsClient() {
  const searchParams = useSearchParams()
  const characterId = searchParams.get('id')
  const router = useRouter()

  const [character, setCharacter] = useState<Character | null>(null)
  const [loadingCharacter, setLoadingCharacter] = useState(true)
  const [characterError, setCharacterError] = useState<string | null>(null)

  const [files, setFiles] = useState<FileEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!characterId) {
      setCharacterError('No character ID provided.')
      setLoadingCharacter(false)
      return
    }
    const supabase = createClient()

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { router.replace('/login'); return }

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      try {
        const res = await fetch(`${WORKER_URL}/api/characters/${characterId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const json = await res.json() as { data?: Character; error?: string }
        if (res.ok && json.data) {
          setCharacter(json.data)
        } else {
          setCharacterError(json.error ?? 'Character not found.')
        }
      } catch {
        setCharacterError('Failed to load character.')
      } finally {
        setLoadingCharacter(false)
      }
    })
  }, [characterId, router])

  useEffect(() => {
    return () => { files.forEach((f) => URL.revokeObjectURL(f.previewUrl)) }
  }, [files])

  function addFiles(incoming: File[]) {
    setUploadError(null)
    const valid: File[] = []
    for (const f of incoming) {
      if (!['image/jpeg', 'image/png'].includes(f.type)) {
        setUploadError(`"${f.name}" is not a JPEG or PNG.`); continue
      }
      if (f.size > 10 * 1024 * 1024) {
        setUploadError(`"${f.name}" exceeds the 10 MB limit.`); continue
      }
      valid.push(f)
    }

    const entries: FileEntry[] = valid.map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      poseType: 'front',
    }))

    setFiles((prev) => {
      const next = [...prev, ...entries]
      if (next.length > 5) {
        next.slice(5).forEach((e) => URL.revokeObjectURL(e.previewUrl))
        setUploadError('Maximum 5 photos allowed.')
        return next.slice(0, 5)
      }
      return next
    })
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files) addFiles(Array.from(e.dataTransfer.files))
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      URL.revokeObjectURL(prev[index].previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  function updatePoseType(index: number, poseType: string) {
    setFiles((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, poseType } : entry))
    )
  }

  const handleSave = useCallback(async () => {
    if (files.length === 0) {
      setUploadError('Add at least one photo before saving.')
      return
    }

    setUploading(true)
    setUploadError(null)
    setSaved(false)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }

      const formData = new FormData()
      const poseTypes: string[] = []
      files.forEach((entry) => {
        formData.append('files', entry.file)
        poseTypes.push(entry.poseType)
      })
      formData.append('pose_types', JSON.stringify(poseTypes))

      const res = await fetch(`${WORKER_URL}/api/characters/${characterId}/references`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      })

      const json = await res.json() as { data?: Character; error?: string }
      if (!res.ok) {
        setUploadError(json.error ?? 'Upload failed. Please try again.')
        return
      }

      if (json.data) setCharacter(json.data)
      setSaved(true)
      setFiles([])
    } catch {
      setUploadError('Network error. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [files, characterId, router])

  if (loadingCharacter) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <div className="space-y-3 w-64 animate-pulse">
          <div className="h-5 rounded bg-[#262626]" />
          <div className="h-3 rounded bg-[#1f1f1f]" />
        </div>
      </div>
    )
  }

  if (characterError || !character) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[#0a0a0a]">
        <p className="text-sm text-red-400">{characterError ?? 'Character not found.'}</p>
        <Link href="/dashboard">
          <Button variant="outline" size="sm" className="border-[#262626] text-[#a1a1aa] hover:text-white">
            ← Back to Dashboard
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <header className="border-b border-[#262626] bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <Link href="/dashboard" className="text-sm text-[#a1a1aa] hover:text-white transition-colors">
            ← Dashboard
          </Link>
          <span className="text-sm font-semibold text-white">PersonalityOS</span>
          <div className="w-24" />
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight text-white">
          {character.name} Settings
        </h1>

        <section className="mt-10">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-white">Give {character.name} a face</h2>
            <p className="mt-1 text-sm text-[#a1a1aa]">Upload 1–5 photos. A front portrait works best.</p>
          </div>

          <div className="mb-5 flex gap-3 rounded-lg border border-indigo-500/20 bg-indigo-500/5 px-4 py-3">
            <span className="text-indigo-400 shrink-0">💡</span>
            <p className="text-sm text-[#a1a1aa]">
              <span className="text-indigo-300 font-medium">Tip:</span> Use a clear front-facing
              photo with good lighting for best consistency.
            </p>
          </div>

          {saved && (
            <div className="mb-6 flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3">
              <span className="text-xl text-green-400">✓</span>
              <p className="text-sm font-medium text-green-300">
                Visual identity saved. {character.name} is ready to generate.
              </p>
            </div>
          )}

          {files.length < 5 && (
            <div
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`mb-5 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 transition-colors ${
                dragging
                  ? 'border-indigo-500 bg-indigo-500/10'
                  : 'border-[#262626] bg-[#0a0a0a] hover:border-[#404040] hover:bg-[#141414]'
              }`}
            >
              <div className="mb-2 text-3xl select-none">📷</div>
              <p className="text-sm font-medium text-white">Drop photos here, or click to browse</p>
              <p className="mt-1 text-xs text-[#71717a]">
                JPEG or PNG · Max 10 MB each · Up to {5 - files.length} more photo{5 - files.length !== 1 ? 's' : ''}
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/jpeg,image/png"
                className="hidden"
                onChange={handleFileInput}
              />
            </div>
          )}

          {files.length > 0 && (
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              {files.map((entry, i) => (
                <div key={i} className="rounded-xl border border-[#262626] bg-[#141414] overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={entry.previewUrl} alt={`Preview ${i + 1}`} className="h-44 w-full object-cover" />
                  <div className="flex items-center gap-2 p-3">
                    <select
                      value={entry.poseType}
                      onChange={(e) => updatePoseType(i, e.target.value)}
                      className="flex-1 rounded-md border border-[#262626] bg-[#0a0a0a] px-2 py-1.5 text-sm text-white focus:border-indigo-500 focus:outline-none"
                    >
                      {Object.entries(POSE_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>{label}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => removeFile(i)}
                      className="rounded-md p-1.5 text-[#71717a] hover:bg-[#262626] hover:text-white transition-colors"
                      aria-label="Remove photo"
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
            onClick={handleSave}
            disabled={uploading || files.length === 0}
            className="w-full bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50"
            size="lg"
          >
            {uploading ? 'Uploading…' : 'Save Reference Images'}
          </Button>

          {character.reference_images_ready === 1 && !saved && (
            <p className="mt-3 text-center text-xs text-[#71717a]">
              {character.name} already has reference photos. Saving new ones will replace them.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}
