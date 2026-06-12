import { Suspense } from 'react'
import SettingsClient from './SettingsClient'

function LoadingShell() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
      <div className="space-y-3 w-64 animate-pulse">
        <div className="h-5 rounded bg-[#262626]" />
        <div className="h-3 rounded bg-[#1f1f1f]" />
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<LoadingShell />}>
      <SettingsClient />
    </Suspense>
  )
}
