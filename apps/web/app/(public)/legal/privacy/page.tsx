// app/(public)/legal/privacy/page.tsx
'use client'

import { PublicShell, DocTitle, DocSection, DocPara, DocList } from '@/components/public/PublicShell'

export default function PrivacyPage() {
  return (
    <PublicShell>
      {(lang) => (lang === 'fr' ? <PrivacyFR /> : <PrivacyEN />)}
    </PublicShell>
  )
}

// ── EN ────────────────────────────────────────────────────────────────────────

function PrivacyEN() {
  return (
    <>
      <DocTitle
        eyebrow="Legal"
        title="Privacy policy"
        updated="Last updated: April 22, 2026"
      />

      <DocSection title="1. Who we are">
        <DocPara>
          CLYRO (&ldquo;we&rdquo;, &ldquo;us&rdquo;, the &ldquo;Service&rdquo;) is operated by{' '}
          <strong>{'{{COMPANY_NAME}}'}</strong>, registered in <strong>{'{{COUNTRY}}'}</strong>,
          registered office: <strong>{'{{ADDRESS}}'}</strong>. You can reach our privacy team at{' '}
          <strong>{'{{CONTACT_EMAIL}}'}</strong>.
        </DocPara>
        <DocPara>
          This policy explains what personal data we collect when you use the CLYRO platform,
          why we collect it, how long we keep it, and the rights you have over it.
        </DocPara>
      </DocSection>

      <DocSection title="2. Data we collect">
        <DocPara>We only collect what we need to run the service:</DocPara>
        <DocList
          items={[
            <><strong>Account data</strong> — email address, password hash (via Supabase Auth), display name, language preference.</>,
            <><strong>Content you submit</strong> — scripts, prompts, brand kits, uploaded assets, video briefs.</>,
            <><strong>Generated outputs</strong> — storyboards, audio tracks, final MP4 renders, and associated metadata (duration, style, credits used).</>,
            <><strong>Usage data</strong> — generation history, credit balance, subscription plan, device and browser info, error logs.</>,
            <><strong>Billing data</strong> — handled by our payment processor (Stripe). We never store your card number; we only retain a customer ID and invoice metadata.</>,
          ]}
        />
      </DocSection>

      <DocSection title="3. Why we process your data">
        <DocList
          items={[
            <>Deliver the service you asked for (generate videos, store your library, bill your plan).</>,
            <>Secure the platform (abuse detection, rate limiting, account protection).</>,
            <>Improve product quality via aggregate, anonymised analytics.</>,
            <>Comply with our legal obligations (tax, accounting, lawful requests).</>,
          ]}
        />
        <DocPara>
          We do <strong>not</strong> sell your data. We do not train foundation models on your
          content.
        </DocPara>
      </DocSection>

      <DocSection title="4. Subprocessors">
        <DocPara>
          To run CLYRO we rely on a handful of vetted vendors. Each is bound by a data
          processing agreement:
        </DocPara>
        <DocList
          items={[
            <><strong>Supabase</strong> — database, authentication, object storage (EU region).</>,
            <><strong>Render</strong> — application hosting (Frankfurt, EU).</>,
            <><strong>Vercel</strong> — web frontend hosting.</>,
            <><strong>Anthropic (Claude)</strong> — script analysis and storyboard generation.</>,
            <><strong>fal.ai</strong> — image and video model inference.</>,
            <><strong>ElevenLabs</strong> — voice synthesis.</>,
            <><strong>HeyGen</strong> — AI avatar rendering.</>,
            <><strong>Stripe</strong> — subscription billing.</>,
            <><strong>Sentry</strong> — error monitoring.</>,
          ]}
        />
      </DocSection>

      <DocSection title="5. International transfers">
        <DocPara>
          Some of our subprocessors are based in the United States. When data leaves the
          European Economic Area we rely on Standard Contractual Clauses and the relevant
          adequacy decisions issued by the European Commission.
        </DocPara>
      </DocSection>

      <DocSection title="6. Retention">
        <DocList
          items={[
            <><strong>Account data</strong> — kept as long as your account is active, deleted within 30 days of account closure.</>,
            <><strong>Generated videos</strong> — stored in your library until you delete them or close your account.</>,
            <><strong>Billing records</strong> — retained 10 years to meet accounting obligations.</>,
            <><strong>Error logs</strong> — 90 days.</>,
          ]}
        />
      </DocSection>

      <DocSection title="7. Your rights">
        <DocPara>Under the GDPR and equivalent laws you can:</DocPara>
        <DocList
          items={[
            <>Access a copy of the data we hold about you.</>,
            <>Rectify inaccurate or outdated information.</>,
            <>Erase your account and associated content.</>,
            <>Restrict or object to certain processing.</>,
            <>Export your data in a portable format.</>,
            <>Lodge a complaint with your local supervisory authority.</>,
          ]}
        />
        <DocPara>
          To exercise any of these rights, email <strong>{'{{CONTACT_EMAIL}}'}</strong>. We respond
          within 30 days.
        </DocPara>
      </DocSection>

      <DocSection title="8. Security">
        <DocPara>
          All traffic is served over HTTPS. Credentials are hashed with bcrypt/argon2.
          Access to production systems is restricted to on-call engineers and logged. We run
          automated vulnerability scans and apply security patches within 72 hours of
          disclosure.
        </DocPara>
      </DocSection>

      <DocSection title="9. Cookies">
        <DocPara>
          We use strictly necessary cookies to keep you signed in and remember your UI
          preferences (theme, language). We do not run third-party advertising trackers on our
          marketing pages.
        </DocPara>
      </DocSection>

      <DocSection title="10. Changes">
        <DocPara>
          If we materially change this policy we will notify you by email and update the date
          at the top of this page before the change takes effect.
        </DocPara>
      </DocSection>
    </>
  )
}

// ── FR ────────────────────────────────────────────────────────────────────────

function PrivacyFR() {
  return (
    <>
      <DocTitle
        eyebrow="Légal"
        title="Politique de confidentialité"
        updated="Dernière mise à jour : 22 avril 2026"
      />

      <DocSection title="1. Qui sommes-nous">
        <DocPara>
          CLYRO (« nous », le « Service ») est exploité par <strong>{'{{COMPANY_NAME}}'}</strong>,
          immatriculée en <strong>{'{{COUNTRY}}'}</strong>, siège social :{' '}
          <strong>{'{{ADDRESS}}'}</strong>. Vous pouvez contacter notre équipe données
          personnelles à <strong>{'{{CONTACT_EMAIL}}'}</strong>.
        </DocPara>
        <DocPara>
          Cette politique explique quelles données personnelles nous collectons lorsque vous
          utilisez la plateforme CLYRO, pourquoi nous les collectons, combien de temps nous les
          conservons et les droits dont vous disposez.
        </DocPara>
      </DocSection>

      <DocSection title="2. Données collectées">
        <DocPara>Nous ne collectons que ce qui est nécessaire :</DocPara>
        <DocList
          items={[
            <><strong>Données de compte</strong> — adresse e-mail, hash du mot de passe (via Supabase Auth), nom affiché, langue préférée.</>,
            <><strong>Contenu que vous soumettez</strong> — scripts, prompts, chartes graphiques, fichiers uploadés, briefs vidéo.</>,
            <><strong>Productions générées</strong> — storyboards, pistes audio, rendus MP4 finaux et métadonnées associées (durée, style, crédits utilisés).</>,
            <><strong>Données d&apos;usage</strong> — historique de génération, solde de crédits, plan d&apos;abonnement, informations navigateur/appareil, logs d&apos;erreur.</>,
            <><strong>Données de facturation</strong> — gérées par notre prestataire de paiement (Stripe). Nous ne stockons jamais votre numéro de carte ; seul un ID client et des métadonnées de facture sont conservés.</>,
          ]}
        />
      </DocSection>

      <DocSection title="3. Finalités">
        <DocList
          items={[
            <>Fournir le service demandé (générer les vidéos, stocker votre bibliothèque, facturer votre plan).</>,
            <>Sécuriser la plateforme (détection d&apos;abus, rate limiting, protection des comptes).</>,
            <>Améliorer la qualité du produit via des statistiques agrégées et anonymisées.</>,
            <>Respecter nos obligations légales (fiscalité, comptabilité, demandes légales).</>,
          ]}
        />
        <DocPara>
          Nous <strong>ne vendons pas</strong> vos données. Nous n&apos;entraînons aucun modèle
          de fondation sur votre contenu.
        </DocPara>
      </DocSection>

      <DocSection title="4. Sous-traitants">
        <DocPara>
          Pour faire fonctionner CLYRO nous nous appuyons sur quelques prestataires sélectionnés.
          Chacun est lié par un accord de traitement des données :
        </DocPara>
        <DocList
          items={[
            <><strong>Supabase</strong> — base de données, authentification, stockage (région UE).</>,
            <><strong>Render</strong> — hébergement applicatif (Francfort, UE).</>,
            <><strong>Vercel</strong> — hébergement du front web.</>,
            <><strong>Anthropic (Claude)</strong> — analyse de script et génération de storyboards.</>,
            <><strong>fal.ai</strong> — inférence des modèles image et vidéo.</>,
            <><strong>ElevenLabs</strong> — synthèse vocale.</>,
            <><strong>HeyGen</strong> — rendu des avatars IA.</>,
            <><strong>Stripe</strong> — facturation des abonnements.</>,
            <><strong>Sentry</strong> — supervision des erreurs.</>,
          ]}
        />
      </DocSection>

      <DocSection title="5. Transferts internationaux">
        <DocPara>
          Certains de nos sous-traitants sont établis aux États-Unis. Lorsque des données
          quittent l&apos;Espace économique européen, nous nous appuyons sur les Clauses
          Contractuelles Types et les décisions d&apos;adéquation pertinentes émises par la
          Commission européenne.
        </DocPara>
      </DocSection>

      <DocSection title="6. Conservation">
        <DocList
          items={[
            <><strong>Données de compte</strong> — conservées tant que votre compte est actif, supprimées dans les 30 jours suivant la clôture.</>,
            <><strong>Vidéos générées</strong> — stockées dans votre bibliothèque jusqu&apos;à suppression ou clôture du compte.</>,
            <><strong>Documents de facturation</strong> — conservés 10 ans au titre des obligations comptables.</>,
            <><strong>Logs d&apos;erreur</strong> — 90 jours.</>,
          ]}
        />
      </DocSection>

      <DocSection title="7. Vos droits">
        <DocPara>En vertu du RGPD et des lois équivalentes, vous pouvez :</DocPara>
        <DocList
          items={[
            <>Accéder à une copie des données que nous détenons.</>,
            <>Rectifier une information inexacte ou obsolète.</>,
            <>Supprimer votre compte et le contenu associé.</>,
            <>Limiter ou vous opposer à certains traitements.</>,
            <>Exporter vos données dans un format portable.</>,
            <>Déposer une réclamation auprès de votre autorité de contrôle (CNIL en France).</>,
          ]}
        />
        <DocPara>
          Pour exercer ces droits, écrivez à <strong>{'{{CONTACT_EMAIL}}'}</strong>. Nous
          répondons sous 30 jours.
        </DocPara>
      </DocSection>

      <DocSection title="8. Sécurité">
        <DocPara>
          Tout le trafic transite en HTTPS. Les mots de passe sont hashés (bcrypt/argon2).
          L&apos;accès aux systèmes de production est restreint aux ingénieurs d&apos;astreinte et
          journalisé. Nous exécutons des scans de vulnérabilité automatisés et appliquons les
          correctifs de sécurité dans les 72 h suivant leur publication.
        </DocPara>
      </DocSection>

      <DocSection title="9. Cookies">
        <DocPara>
          Nous utilisons des cookies strictement nécessaires pour vous maintenir connecté et
          mémoriser vos préférences d&apos;interface (thème, langue). Aucun traceur publicitaire
          tiers n&apos;est déposé sur nos pages marketing.
        </DocPara>
      </DocSection>

      <DocSection title="10. Modifications">
        <DocPara>
          En cas de modification substantielle, nous vous informons par e-mail et mettons à
          jour la date en haut de cette page avant son entrée en vigueur.
        </DocPara>
      </DocSection>
    </>
  )
}
