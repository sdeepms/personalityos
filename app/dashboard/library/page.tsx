import { Suspense } from 'react'
import LibraryClient from './LibraryClient'

function LoadingShell() {
  return (
    <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="w-64 space-y-3 animate-pulse">
        <div className="h-5 rounded bg-[#262626]" />
        <div className="h-3 rounded bg-[#1f1f1f]" />
      </div>
    </div>
  )
}

export const metadata = { title: 'Library' }

export default function LibraryPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <LibraryClient />
    </Suspense>
  )
}
