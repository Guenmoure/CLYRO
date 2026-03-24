import Link from 'next/link'

export const metadata = { title: 'Faceless Videos — CLYRO' }

export default function FacelessPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <p className="label-mono mb-1">Module</p>
          <h1 className="font-display text-2xl font-bold text-foreground">Faceless Videos</h1>
        </div>
        <Link
          href="/faceless/new"
          className="bg-grad-primary text-white font-display font-semibold px-6 py-3 rounded-xl hover:opacity-90 transition-opacity"
        >
          + Nouvelle vidéo
        </Link>
      </div>
      <p className="text-muted-foreground font-body">
        Vos projets Faceless Videos apparaîtront ici.
      </p>
    </div>
  )
}
