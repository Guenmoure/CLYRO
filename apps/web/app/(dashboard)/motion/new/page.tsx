import { MotionWizard } from '@/components/motion/motion-wizard'

export const metadata = { title: 'Nouvelle vidéo Motion — CLYRO' }

export default function NewMotionPage() {
  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <p className="label-mono mb-1">Motion Graphics</p>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Créer une nouvelle publicité
        </h1>
      </div>
      <MotionWizard />
    </div>
  )
}
