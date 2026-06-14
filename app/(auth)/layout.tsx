export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-start justify-center bg-[#0a0a0a] px-4 py-12">
      {children}
    </div>
  )
}
