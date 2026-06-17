'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Check, Plus, Pencil, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/browser'

const WORKER_URL = process.env.NEXT_PUBLIC_WORKER_URL ?? 'http://localhost:8787'

type Character = {
  id: string
  name: string
  character_type?: string | null
}

type Offer = {
  id: string
  label: string
  description: string
  sort_order: number
  created_at: string
}

export default function TemplatesPage() {
  const searchParams  = useSearchParams()
  const router        = useRouter()
  const characterId   = searchParams.get('id')

  const [character,    setCharacter]   = useState<Character | null>(null)
  const [offers,       setOffers]      = useState<Offer[]>([])
  const [loading,      setLoading]     = useState(true)
  const [authToken,    setAuthToken]   = useState<string | null>(null)

  // Add/Edit modal
  const [showModal,         setShowModal]         = useState(false)
  const [editingOffer,      setEditingOffer]      = useState<Offer | null>(null)
  const [modalLabel,        setModalLabel]        = useState('')
  const [modalDescription,  setModalDescription]  = useState('')
  const [modalError,        setModalError]        = useState<string | null>(null)
  const [modalSaving,       setModalSaving]       = useState(false)

  // Delete
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchOffers = useCallback(async (token: string) => {
    if (!characterId) return
    const res  = await fetch(`${WORKER_URL}/api/characters/${characterId}/offers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    const json = await res.json() as { data?: Offer[] }
    setOffers(json.data ?? [])
  }, [characterId])

  useEffect(() => {
    if (!characterId) { router.replace('/dashboard'); return }
    const supabase = createClient()

    async function init() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { router.replace('/login'); return }
      setAuthToken(session.access_token)

      try {
        const [charRes] = await Promise.all([
          fetch(`${WORKER_URL}/api/characters/${characterId}`, {
            headers: { Authorization: `Bearer ${session.access_token}` },
          }),
        ])
        if (charRes.status === 401) { router.replace('/login'); return }
        if (!charRes.ok)            { router.replace('/dashboard'); return }

        const charJson = await charRes.json() as { data: Character }
        setCharacter(charJson.data)

        await fetchOffers(session.access_token)
      } catch {
        // leave loading state, show empty
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [characterId, router, fetchOffers])

  function openAddModal() {
    setEditingOffer(null)
    setModalLabel('')
    setModalDescription('')
    setModalError(null)
    setShowModal(true)
  }

  function openEditModal(offer: Offer) {
    setEditingOffer(offer)
    setModalLabel(offer.label)
    setModalDescription(offer.description)
    setModalError(null)
    setShowModal(true)
  }

  async function handleSave() {
    if (!authToken || !characterId) return
    setModalSaving(true)
    setModalError(null)

    const body = {
      label:       modalLabel.trim(),
      description: modalDescription.trim(),
    }

    try {
      const url = editingOffer
        ? `${WORKER_URL}/api/characters/${characterId}/offers/${editingOffer.id}`
        : `${WORKER_URL}/api/characters/${characterId}/offers`

      const res  = await fetch(url, {
        method:  editingOffer ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${authToken}` },
        body:    JSON.stringify(body),
      })
      const json = await res.json() as { error?: string }

      if (!res.ok) {
        setModalError(json.error ?? 'Failed to save')
        return
      }

      await fetchOffers(authToken)
      setShowModal(false)
    } catch {
      setModalError('Network error.')
    } finally {
      setModalSaving(false)
    }
  }

  async function handleDelete(offerId: string) {
    if (!authToken || !characterId) return
    setDeletingId(offerId)
    try {
      await fetch(`${WORKER_URL}/api/characters/${characterId}/offers/${offerId}`, {
        method:  'DELETE',
        headers: { Authorization: `Bearer ${authToken}` },
      })
      await fetchOffers(authToken)
    } catch {
      // silent
    } finally {
      setDeletingId(null)
    }
  }

  const inputCls =
    'w-full rounded-lg border border-[#262626] bg-[#141414] px-3 py-2.5 text-sm text-white ' +
    'placeholder:text-[#71717a] focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500'

  return (
    <div className="min-h-screen bg-[#0a0a0a]">

      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#262626] bg-[#0a0a0a]">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-[#71717a] transition-colors hover:text-white"
              aria-label="Back"
            >
              ← Back
            </button>
            <h1 className="text-base font-semibold text-white">Templates</h1>
          </div>
          {!loading && offers.length < 10 && (
            <button
              onClick={openAddModal}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 transition-colors"
            >
              <Plus size={15} />
              Add
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-6">

        <p className="mb-6 text-sm text-[#a1a1aa]">
          Templates appear as quick-tap pills in your chat.
          Tap any pill to instantly fill the message box.
        </p>

        {/* Pills preview */}
        {offers.length > 0 && (
          <div className="mb-6">
            <p className="mb-2 text-xs uppercase tracking-wider text-[#71717a]">
              Preview — how they appear in chat
            </p>
            <div className="flex flex-wrap gap-2">
              {offers.map(offer => (
                <span
                  key={offer.id}
                  className="rounded-full border border-[#404040] bg-[#1a1a1a] px-3 py-1.5 text-xs text-[#a1a1aa]"
                >
                  {offer.label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="animate-pulse rounded-lg border border-[#262626] bg-[#141414] p-4">
                <div className="h-4 w-32 rounded bg-[#262626]" />
                <div className="mt-2 h-3 w-full rounded bg-[#1f1f1f]" />
                <div className="mt-1 h-3 w-4/5 rounded bg-[#1f1f1f]" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && offers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm font-medium text-white">No templates yet</p>
            <p className="mt-1 text-sm text-[#71717a]">
              Add your first template to speed up content creation.
            </p>
            <button
              onClick={openAddModal}
              className="mt-4 flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors"
            >
              <Plus size={15} />
              Add your first template
            </button>
          </div>
        )}

        {/* Offers list */}
        {!loading && offers.length > 0 && (
          <>
            <div className="space-y-3">
              {offers.map(offer => (
                <div
                  key={offer.id}
                  className="rounded-lg border border-[#262626] bg-[#141414] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-white">
                        {offer.label}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-[#71717a]">
                        {offer.description}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        onClick={() => openEditModal(offer)}
                        className="rounded p-1.5 text-[#71717a] transition-colors hover:bg-[#262626] hover:text-white"
                        title="Edit"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        onClick={() => handleDelete(offer.id)}
                        disabled={deletingId === offer.id}
                        className="rounded p-1.5 text-[#71717a] transition-colors hover:bg-red-950/30 hover:text-red-400 disabled:opacity-50"
                        title="Delete"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-right text-xs text-[#71717a]">
              {offers.length} / 10 templates
            </p>
          </>
        )}

      </main>

      {/* Add / Edit modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/70">
          <div className="fixed left-1/2 top-1/2 mx-4 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-[#262626] bg-[#141414] p-6">
            <h2 className="mb-4 text-base font-semibold text-white">
              {editingOffer ? 'Edit template' : 'New template'}
            </h2>

            <div className="space-y-4">

              {/* Label */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">
                  Pill label
                  <span className="ml-1 text-[#71717a]">(shown as button)</span>
                </label>
                <input
                  value={modalLabel}
                  onChange={e => setModalLabel(e.target.value.slice(0, 30))}
                  placeholder="e.g. Red Kurti ₹899"
                  maxLength={30}
                  className={inputCls}
                />
                <p className="mt-1 text-right text-xs text-[#71717a]">
                  {modalLabel.length}/30
                </p>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-[#a1a1aa]">
                  Full description
                  <span className="ml-1 text-[#71717a]">(sent to AI)</span>
                </label>
                <textarea
                  value={modalDescription}
                  onChange={e => setModalDescription(e.target.value.slice(0, 200))}
                  placeholder="e.g. Red Silk Kurti, price ₹899, available in sizes S, M, L, XL. DM to order. COD available."
                  rows={3}
                  maxLength={200}
                  className={inputCls + ' resize-none'}
                />
                <p className="mt-1 text-right text-xs text-[#71717a]">
                  {modalDescription.length}/200
                </p>
              </div>

              {/* Error */}
              {modalError && (
                <p className="text-xs text-red-400">{modalError}</p>
              )}

            </div>

            {/* Buttons */}
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="text-sm text-[#a1a1aa] transition-colors hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!modalLabel.trim() || !modalDescription.trim() || modalSaving}
                className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-500 transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {modalSaving ? (
                  'Saving…'
                ) : (
                  <>
                    <Check size={14} />
                    Save template
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}
