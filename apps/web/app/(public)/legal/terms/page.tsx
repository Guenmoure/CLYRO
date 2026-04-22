// app/(public)/legal/terms/page.tsx
'use client'

import { PublicShell, DocTitle, DocSection, DocPara, DocList } from '@/components/public/PublicShell'

export default function TermsPage() {
  return (
    <PublicShell>
      {(lang) => (lang === 'fr' ? <TermsFR /> : <TermsEN />)}
    </PublicShell>
  )
}

// ── EN ────────────────────────────────────────────────────────────────────────

function TermsEN() {
  return (
    <>
      <DocTitle
        eyebrow="Legal"
        title="Terms of service"
        updated="Last updated: April 22, 2026"
      />

      <DocSection title="1. Agreement">
        <DocPara>
          These Terms govern your access to and use of CLYRO (&ldquo;Service&rdquo;), operated by{' '}
          <strong>{'{{COMPANY_NAME}}'}</strong>. By creating an account or using the Service you
          agree to these Terms. If you don&rsquo;t agree, do not use the Service.
        </DocPara>
      </DocSection>

      <DocSection title="2. Eligibility">
        <DocPara>
          You must be at least 16 years old, or the minimum digital-consent age in your country
          if higher. If you use the Service on behalf of an organisation, you represent that you
          are authorised to bind that organisation to these Terms.
        </DocPara>
      </DocSection>

      <DocSection title="3. Your account">
        <DocList
          items={[
            <>You are responsible for keeping your credentials safe and for all activity under your account.</>,
            <>Notify us immediately at <strong>{'{{CONTACT_EMAIL}}'}</strong> if you suspect unauthorised access.</>,
            <>One person or entity per account. Sharing seats is not permitted on individual plans.</>,
          ]}
        />
      </DocSection>

      <DocSection title="4. Credits &amp; subscriptions">
        <DocList
          items={[
            <>Generation consumes credits. Each feature discloses its cost before you confirm.</>,
            <>Paid subscriptions renew automatically at the end of each billing period.</>,
            <>Unused credits roll over while your subscription is active.</>,
            <>Top-up credits are non-refundable once consumed.</>,
            <>You can cancel at any time from your billing settings. Access continues until the end of the paid period.</>,
          ]}
        />
      </DocSection>

      <DocSection title="5. Acceptable use">
        <DocPara>You agree not to use CLYRO to generate, distribute, or store content that:</DocPara>
        <DocList
          items={[
            <>infringes the rights of any third party (copyright, trademark, privacy, publicity);</>,
            <>depicts a real identifiable person without their verifiable consent (no non-consensual deepfakes);</>,
            <>involves minors in sexual, violent, or otherwise harmful scenarios;</>,
            <>promotes hate, harassment, terrorism, or self-harm;</>,
            <>impersonates real individuals with intent to defraud or defame;</>,
            <>is misleading in a political, medical, or financial context without clear disclosure.</>,
          ]}
        />
        <DocPara>
          We may suspend or terminate accounts that breach this section, without refund.
        </DocPara>
      </DocSection>

      <DocSection title="6. Your content &amp; licence">
        <DocPara>
          You retain ownership of the scripts, brand assets, and uploaded media you bring to
          CLYRO. You grant us a limited, worldwide, non-exclusive licence to host, transform,
          and render that content for the sole purpose of delivering the Service to you.
        </DocPara>
        <DocPara>
          We do <strong>not</strong> use your content to train foundation models, and we do not
          share it with third parties other than the subprocessors listed in our{' '}
          <a href="/legal/privacy" className="underline underline-offset-2 hover:text-foreground">Privacy policy</a>.
        </DocPara>
      </DocSection>

      <DocSection title="7. AI-generated outputs">
        <DocPara>
          CLYRO uses multiple AI providers (see Privacy policy) and outputs may contain
          inaccuracies. You are responsible for reviewing generated content before publication.
          You are granted the rights to the outputs subject to the acceptable-use rules above
          and to the terms of the underlying providers.
        </DocPara>
      </DocSection>

      <DocSection title="8. Availability">
        <DocPara>
          We aim for high availability but the Service is provided &ldquo;as is&rdquo; and may be
          temporarily unavailable for maintenance, upstream incidents, or force majeure. Live
          status is published at{' '}
          <a href="/resources/status" className="underline underline-offset-2 hover:text-foreground">/resources/status</a>.
        </DocPara>
      </DocSection>

      <DocSection title="9. Liability">
        <DocPara>
          To the maximum extent permitted by law, our total liability in connection with the
          Service is limited to the amount you paid to us in the twelve months preceding the
          event giving rise to the claim. We are not liable for indirect or consequential
          damages, loss of profits, or loss of data beyond what is recoverable from our
          backups.
        </DocPara>
      </DocSection>

      <DocSection title="10. Termination">
        <DocPara>
          You can close your account at any time. We can suspend or terminate access for
          breach of these Terms, fraud, or non-payment. After termination we will delete your
          content within 30 days, except where retention is legally required.
        </DocPara>
      </DocSection>

      <DocSection title="11. Changes">
        <DocPara>
          We may update these Terms from time to time. Material changes will be notified by
          email at least 30 days before taking effect. Continued use of the Service after the
          effective date constitutes acceptance of the new Terms.
        </DocPara>
      </DocSection>

      <DocSection title="12. Governing law">
        <DocPara>
          These Terms are governed by the laws of <strong>{'{{COUNTRY}}'}</strong>. Disputes
          fall under the exclusive jurisdiction of the courts of{' '}
          <strong>{'{{COUNTRY}}'}</strong>, without prejudice to any mandatory consumer
          protections in your country of residence.
        </DocPara>
      </DocSection>
    </>
  )
}

// ── FR ────────────────────────────────────────────────────────────────────────

function TermsFR() {
  return (
    <>
      <DocTitle
        eyebrow="Légal"
        title="Conditions générales d&rsquo;utilisation"
        updated="Dernière mise à jour : 22 avril 2026"
      />

      <DocSection title="1. Accord">
        <DocPara>
          Les présentes CGU régissent l&apos;accès et l&apos;utilisation de CLYRO (le « Service »),
          exploité par <strong>{'{{COMPANY_NAME}}'}</strong>. En créant un compte ou en utilisant
          le Service, vous acceptez ces CGU. Si vous n&apos;êtes pas d&apos;accord, n&apos;utilisez
          pas le Service.
        </DocPara>
      </DocSection>

      <DocSection title="2. Éligibilité">
        <DocPara>
          Vous devez avoir au moins 16 ans, ou l&apos;âge minimum de consentement numérique de
          votre pays s&apos;il est supérieur. Si vous utilisez le Service pour une organisation,
          vous garantissez être habilité à l&apos;engager.
        </DocPara>
      </DocSection>

      <DocSection title="3. Votre compte">
        <DocList
          items={[
            <>Vous êtes responsable de la confidentialité de vos identifiants et de toute activité sur votre compte.</>,
            <>Signalez immédiatement tout accès non autorisé à <strong>{'{{CONTACT_EMAIL}}'}</strong>.</>,
            <>Une personne ou entité par compte. Le partage de siège n&apos;est pas autorisé sur les plans individuels.</>,
          ]}
        />
      </DocSection>

      <DocSection title="4. Crédits &amp; abonnements">
        <DocList
          items={[
            <>Chaque génération consomme des crédits. Le coût est affiché avant confirmation.</>,
            <>Les abonnements payants se renouvellent automatiquement à la fin de chaque période de facturation.</>,
            <>Les crédits inutilisés sont reportés tant que l&apos;abonnement est actif.</>,
            <>Les crédits achetés à l&apos;unité (top-up) ne sont pas remboursables une fois consommés.</>,
            <>Vous pouvez résilier à tout moment depuis vos paramètres de facturation. L&apos;accès continue jusqu&apos;à la fin de la période payée.</>,
          ]}
        />
      </DocSection>

      <DocSection title="5. Usage autorisé">
        <DocPara>Vous vous engagez à ne pas utiliser CLYRO pour générer, diffuser ou stocker du contenu qui :</DocPara>
        <DocList
          items={[
            <>porte atteinte aux droits d&apos;un tiers (droit d&apos;auteur, marque, vie privée, droit à l&apos;image) ;</>,
            <>représente une personne réelle identifiable sans son consentement vérifiable (aucun deepfake non consenti) ;</>,
            <>implique des mineurs dans des scénarios sexuels, violents ou préjudiciables ;</>,
            <>promeut la haine, le harcèlement, le terrorisme ou l&apos;auto-mutilation ;</>,
            <>usurpe l&apos;identité d&apos;une personne réelle à des fins de fraude ou de diffamation ;</>,
            <>induit en erreur dans un contexte politique, médical ou financier sans mention claire.</>,
          ]}
        />
        <DocPara>
          Nous pouvons suspendre ou résilier sans remboursement tout compte en infraction.
        </DocPara>
      </DocSection>

      <DocSection title="6. Votre contenu &amp; licence">
        <DocPara>
          Vous restez propriétaire des scripts, charte graphique et médias uploadés. Vous nous
          concédez une licence limitée, mondiale et non exclusive pour héberger, transformer et
          rendre ce contenu, uniquement afin de vous fournir le Service.
        </DocPara>
        <DocPara>
          Nous <strong>n&apos;utilisons pas</strong> votre contenu pour entraîner des modèles de
          fondation et ne le partageons qu&apos;avec les sous-traitants listés dans notre{' '}
          <a href="/legal/privacy?lang=fr" className="underline underline-offset-2 hover:text-foreground">politique de confidentialité</a>.
        </DocPara>
      </DocSection>

      <DocSection title="7. Productions IA">
        <DocPara>
          CLYRO s&apos;appuie sur plusieurs fournisseurs d&apos;IA (voir la politique de
          confidentialité) et les productions peuvent contenir des inexactitudes. Vous êtes
          responsable de la relecture du contenu généré avant publication. Les droits sur les
          productions vous sont accordés sous réserve du respect des règles ci-dessus et des
          conditions des fournisseurs sous-jacents.
        </DocPara>
      </DocSection>

      <DocSection title="8. Disponibilité">
        <DocPara>
          Nous visons une haute disponibilité mais le Service est fourni « en l&apos;état » et
          peut être temporairement indisponible pour maintenance, incident en amont ou force
          majeure. Le statut en temps réel est publié sur{' '}
          <a href="/resources/status?lang=fr" className="underline underline-offset-2 hover:text-foreground">/resources/status</a>.
        </DocPara>
      </DocSection>

      <DocSection title="9. Responsabilité">
        <DocPara>
          Dans toute la mesure permise par la loi, notre responsabilité totale liée au Service
          est plafonnée au montant que vous nous avez payé durant les douze mois précédant
          l&apos;événement à l&apos;origine de la réclamation. Nous ne sommes pas responsables des
          dommages indirects ou consécutifs, des pertes de profits ni des pertes de données
          au-delà de ce qui est récupérable depuis nos sauvegardes.
        </DocPara>
      </DocSection>

      <DocSection title="10. Résiliation">
        <DocPara>
          Vous pouvez clôturer votre compte à tout moment. Nous pouvons suspendre ou résilier
          l&apos;accès en cas de violation des CGU, de fraude ou d&apos;impayé. Après résiliation,
          votre contenu est supprimé sous 30 jours, sauf conservation légalement requise.
        </DocPara>
      </DocSection>

      <DocSection title="11. Évolutions">
        <DocPara>
          Ces CGU peuvent évoluer. Toute modification substantielle sera notifiée par e-mail au
          moins 30 jours avant son entrée en vigueur. L&apos;utilisation continue du Service
          après cette date vaut acceptation des nouvelles CGU.
        </DocPara>
      </DocSection>

      <DocSection title="12. Droit applicable">
        <DocPara>
          Les présentes CGU sont régies par le droit de <strong>{'{{COUNTRY}}'}</strong>. Les
          litiges relèvent de la compétence exclusive des tribunaux de{' '}
          <strong>{'{{COUNTRY}}'}</strong>, sans préjudice des protections consommateur
          impératives de votre pays de résidence.
        </DocPara>
      </DocSection>
    </>
  )
}
