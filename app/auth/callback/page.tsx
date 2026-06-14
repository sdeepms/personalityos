'use client'
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/browser'

export default function AuthCallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        router.push('/dashboard')
      }
    })
  }, [router])

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <p className="text-zinc-400 text-sm">Signing you in...</p>
    </div>
  )
}
