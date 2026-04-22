// app/(public)/legal/notice/page.tsx
'use client'

import { PublicShell, DocTitle, DocSection, DocPara, DocList } from '@/components/public/PublicShell'

export default function NoticePage() {
  return (
    <PublicShell>
      {(lang) => (lang === 'fr' ? <NoticeFR /> : <NoticeEN />)}
    </PublicShell>
  )
}

// ── EN ────────────────────────────────────────────────────────────────────────

function NoticeEN() {
  return (
    <>
      <DocTitle
        eyebrow="Legal"
        title="Legal notice"
        updated="Last updated: April 22, 2026"
      />

      <DocSection title="Publisher">
        <DocPara>
          This website is published by <strong>{'{{COMPANY_NAME}}'}</strong>, a company
          registered in <strong>{'{{COUNTRY}}'}</strong>.
        </DocPara>
        <DocList
          items={[
            <><strong>Registered office:</strong> {'{{ADDRESS}}'}</>,
            <><strong>Registration number:</strong> {'{{REGISTRATION_NUMBER}}'}</>,
            <><strong>VAT number:</strong> {'{{VAT_NUMBER}}'}</>,
            <><strong>Share capital:</strong> {'{{SHARE_CAPITAL}}'}</>,
            <><strong>Publishing director:</strong> {'{{PUBLISHING_DIRECTOR}}'}</>,
            <><strong>Contact:</strong> {'{{CONTACT_EMAIL}}'}</>,
          ]}
        />
      </DocSection>

      <DocSection title="Hosting">
        <DocList
          items={[
            <><strong>Web frontend</strong> — Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.</>,
            <><strong>API &amp; rendering</strong> — Render Inc. (Frankfurt region), 525 Brannan St, San Francisco, CA 94107, USA.</>,
            <><strong>Database &amp; object storage</strong> — Supabase Inc., 970 Toa Payoh North, Singapore 318992 — data hosted in the EU region.</>,
          ]}
        />
      </DocSection>

      <DocSection title="Intellectual property">
        <DocPara>
          The CLYRO name, logo, visual identity, source code, and editorial content are the
          exclusive property of <strong>{'{{COMPANY_NAME}}'}</strong> or its licensors. Any
          reproduction, adaptation, or distribution without prior written consent is prohibited.
        </DocPara>
        <DocPara>
          Third-party names and logos shown on the site (Anthropic, fal.ai, ElevenLabs,
          HeyGen, Supabase, etc.) belong to their respective owners and are used for
          descriptive purposes only.
        </DocPara>
      </DocSection>

      <DocSection title="Reporting abuse">
        <DocPara>
          To report illegal content, a security vulnerability, or an intellectual property
          infringement, email <strong>{'{{CONTACT_EMAIL}}'}</strong> with the URL of the content
          and a clear description. We acknowledge within 48 hours.
        </DocPara>
      </DocSection>
    </>
  )
}

// ── FR ────────────────────────────────────────────────────────────────────────

function NoticeFR() {
  return (
    <>
      <DocTitle
        eyebrow="Légal"
        title="Mentions légales"
        updated="Dernière mise à jour : 22 avril 2026"
      />

      <DocSection title="Éditeur">
        <DocPara>
          Ce site est édité par <strong>{'{{COMPANY_NAME}}'}</strong>, société immatriculée en{' '}
          <strong>{'{{COUNTRY}}'}</strong>.
        </DocPara>
        <DocList
          items={[
            <><strong>Siège social :</strong> {'{{ADDRESS}}'}</>,
            <><strong>Numéro d&apos;immatriculation :</strong> {'{{REGISTRATION_NUMBER}}'}</>,
            <><strong>Numéro de TVA :</strong> {'{{VAT_NUMBER}}'}</>,
            <><strong>Capital social :</strong> {'{{SHARE_CAPITAL}}'}</>,
            <><strong>Directeur de la publication :</strong> {'{{PUBLISHING_DIRECTOR}}'}</>,
            <><strong>Contact :</strong> {'{{CONTACT_EMAIL}}'}</>,
          ]}
        />
      </DocSection>

      <DocSection title="Hébergement">
        <DocList
          items={[
            <><strong>Front web</strong> — Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, USA.</>,
            <><strong>API &amp; rendu</strong> — Render Inc. (région Francfort), 525 Brannan St, San Francisco, CA 94107, USA.</>,
            <><strong>Base de données &amp; stockage</strong> — Supabase Inc., 970 Toa Payoh North, Singapour 318992 — données hébergées en région UE.</>,
          ]}
        />
      </DocSection>

      <DocSection title="Propriété intellectuelle">
        <DocPara>
          La marque CLYRO, son logo, son identité visuelle, son code source et son contenu
          éditorial sont la propriété exclusive de <strong>{'{{COMPANY_NAME}}'}</strong> ou de
          ses concédants. Toute reproduction, adaptation ou diffusion sans accord écrit
          préalable est interdite.
        </DocPara>
        <DocPara>
          Les noms et logos tiers présents sur le site (Anthropic, fal.ai, ElevenLabs, HeyGen,
          Supabase, etc.) appartiennent à leurs propriétaires respectifs et sont utilisés à
          des fins descriptives uniquement.
        </DocPara>
      </DocSection>

      <DocSection title="Signalement">
        <DocPara>
          Pour signaler un contenu illicite, une faille de sécurité ou une atteinte aux droits
          de propriété intellectuelle, écrivez à <strong>{'{{CONTACT_EMAIL}}'}</strong> en
          indiquant l&apos;URL concernée et une description claire. Accusé de réception sous 48 h.
        </DocPara>
      </DocSection>
    </>
  )
}
