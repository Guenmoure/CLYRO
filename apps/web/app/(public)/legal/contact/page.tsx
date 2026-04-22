// app/(public)/legal/contact/page.tsx
'use client'

import { Mail, MessageSquare, Shield, Briefcase } from 'lucide-react'
import { PublicShell, DocTitle, DocSection, DocPara } from '@/components/public/PublicShell'

type Lang = 'en' | 'fr'

export default function ContactPage() {
  return (
    <PublicShell>
      {(lang) => <ContactBody lang={lang} />}
    </PublicShell>
  )
}

function ContactBody({ lang }: { lang: Lang }) {
  const labels = lang === 'fr'
    ? {
        eyebrow: 'Légal',
        title: 'Contact',
        updated: 'Dernière mise à jour : 22 avril 2026',
        intro: 'Une question, un bug, une suggestion ? Nous lisons chaque message. Pour aller vite, utilisez la bonne adresse.',
      }
    : {
        eyebrow: 'Legal',
        title: 'Contact',
        updated: 'Last updated: April 22, 2026',
        intro: 'A question, a bug, a suggestion? We read every message. Use the right address so we can route you fast.',
      }

  const channels = lang === 'fr'
    ? [
        { icon: MessageSquare, title: 'Support produit',    desc: 'Bugs, générations qui échouent, questions sur votre compte.', email: '{{CONTACT_EMAIL}}',      color: 'text-blue-500' },
        { icon: Briefcase,     title: 'Commercial & partenariats', desc: 'Volumes, plans équipe, intégrations API, co-marketing.', email: '{{SALES_EMAIL}}',       color: 'text-emerald-500' },
        { icon: Shield,        title: 'Confidentialité &amp; sécurité', desc: 'Demandes RGPD, signalement de vulnérabilité, abus.',    email: '{{PRIVACY_EMAIL}}',     color: 'text-amber-500' },
        { icon: Mail,          title: 'Presse',             desc: 'Demandes média, kit presse, interviews.',                         email: '{{PRESS_EMAIL}}',       color: 'text-violet-500' },
      ]
    : [
        { icon: MessageSquare, title: 'Product support',         desc: 'Bugs, failed generations, account questions.',                 email: '{{CONTACT_EMAIL}}',      color: 'text-blue-500' },
        { icon: Briefcase,     title: 'Sales & partnerships',    desc: 'Volume pricing, team plans, API integrations, co-marketing.', email: '{{SALES_EMAIL}}',       color: 'text-emerald-500' },
        { icon: Shield,        title: 'Privacy & security',      desc: 'GDPR requests, vulnerability reports, abuse.',                email: '{{PRIVACY_EMAIL}}',     color: 'text-amber-500' },
        { icon: Mail,          title: 'Press',                   desc: 'Media enquiries, press kit, interviews.',                     email: '{{PRESS_EMAIL}}',       color: 'text-violet-500' },
      ]

  const responseLabel = lang === 'fr'
    ? 'Temps de réponse moyen : moins de 24 h ouvrées.'
    : 'Average response time: under 24 business hours.'

  const registeredMailLabel = lang === 'fr'
    ? 'Courrier postal'
    : 'Postal mail'

  const registeredMailCopy = lang === 'fr'
    ? 'Pour les courriers recommandés, envoyez à notre siège social :'
    : 'For registered mail, write to our registered office:'

  return (
    <>
      <DocTitle eyebrow={labels.eyebrow} title={labels.title} updated={labels.updated} />

      <DocSection title={lang === 'fr' ? 'Comment nous joindre' : 'How to reach us'}>
        <DocPara>{labels.intro}</DocPara>
      </DocSection>

      <div className="grid sm:grid-cols-2 gap-4 mb-12">
        {channels.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-border/50 bg-card/40 p-5 hover:bg-card/60 transition-colors"
          >
            <div className="flex items-center gap-2.5 mb-2">
              <c.icon size={18} className={c.color} />
              <h3
                className="font-display font-semibold text-foreground"
                dangerouslySetInnerHTML={{ __html: c.title }}
              />
            </div>
            <p className="font-body text-sm text-[--text-secondary] mb-3">{c.desc}</p>
            <a
              href={`mailto:${c.email}`}
              className="font-mono text-xs text-blue-500 hover:underline underline-offset-2"
            >
              {c.email}
            </a>
          </div>
        ))}
      </div>

      <DocSection title={registeredMailLabel}>
        <DocPara>{registeredMailCopy}</DocPara>
        <DocPara>
          <strong>{'{{COMPANY_NAME}}'}</strong>
          <br />
          {'{{ADDRESS}}'}
          <br />
          {'{{COUNTRY}}'}
        </DocPara>
      </DocSection>

      <DocSection title={lang === 'fr' ? 'Réponse' : 'Response'}>
        <DocPara>{responseLabel}</DocPara>
      </DocSection>
    </>
  )
}
