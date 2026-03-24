export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-navy-950 grid-bg flex items-center justify-center p-4">
      <div className="glow-radial-blue absolute inset-0 pointer-events-none" />
      <div className="relative w-full max-w-md">
        {children}
      </div>
    </div>
  )
}
