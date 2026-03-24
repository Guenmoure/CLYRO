import { FacelessWizard } from '@/components/faceless/faceless-wizard'

export const metadata = { title: 'Nouvelle vidéo Faceless — CLYRO' }

export default function NewFacelessPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <p className="label-mono mb-1">Faceless Videos</p>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Créer une nouvelle vidéo
        </h1>
      </div>
      <FacelessWizard />
    </div>
  )
}
