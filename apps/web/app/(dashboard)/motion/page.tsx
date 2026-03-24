import Link from 'next/link'

export const metadata = { title: 'Motion Graphics — CLYRO' }

export default function MotionPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-mono mb-1">Module</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Motion Graphics</h1>
        </div>
        <Link
          href="/motion/new"
          className="bg-grad-primary text-white font-display font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          + Nouvelle vidéo
        </Link>
      </div>
      <p className="text-muted-foreground font-body">
        Vos projets Motion Graphics apparaîtront ici.
      </p>
    </div>
  )
}
