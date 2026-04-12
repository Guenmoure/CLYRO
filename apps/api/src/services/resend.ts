import { Resend } from 'resend'
import { logger } from '../lib/logger'

function getResendClient(): Resend {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error('Missing RESEND_API_KEY environment variable')
  return new Resend(apiKey)
}

// En prod : 'CLYRO <noreply@clyro.app>' (domaine vérifié dans Resend)
// En dev : onboarding@resend.dev (domaine Resend par défaut, pas de vérification requise)
const FROM_EMAIL =
  process.env.NODE_ENV === 'production'
    ? 'CLYRO <noreply@clyro.app>'
    : 'CLYRO <onboarding@resend.dev>'
const FRONTEND_URL = process.env.FRONTEND_URL ?? 'https://app.clyro.app'

// ── Email Templates ────────────────────────────────────────────────────────

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CLYRO</title>
  <style>
    body { margin: 0; padding: 0; background-color: #060810; font-family: 'DM Sans', Arial, sans-serif; }
    .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
    .logo { font-size: 28px; font-weight: 900; background: linear-gradient(135deg, #3B8EF0, #9B5CF6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 32px; }
    .card { background-color: #0A0D1A; border: 1px solid #151C38; border-radius: 16px; padding: 32px; }
    h1 { color: #F5F5F5; font-size: 24px; margin: 0 0 16px; }
    p { color: #8892A4; font-size: 16px; line-height: 1.6; margin: 0 0 16px; }
    .btn { display: inline-block; background: linear-gradient(135deg, #3B8EF0, #9B5CF6); color: white !important; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-weight: 600; font-size: 16px; margin: 16px 0; }
    .footer { text-align: center; color: #4A5568; font-size: 12px; margin-top: 24px; }
    .highlight { color: #3B8EF0; font-weight: 600; }
  </style>
</head>
<body>
  <div class="container">
    <div class="logo">CLYRO</div>
    <div class="card">${content}</div>
    <div class="footer">
      <p>© 2026 CLYRO — AI Video Generation Platform</p>
      <p>Si vous n'avez pas créé ce compte, ignorez cet email.</p>
    </div>
  </div>
</body>
</html>`
}

// ── Email senders ──────────────────────────────────────────────────────────

/**
 * Email de bienvenue après inscription
 */
export async function sendWelcomeEmail(to: string, fullName: string): Promise<void> {
  const resend = getResendClient()

  const html = baseTemplate(`
    <h1>Bienvenue sur CLYRO, ${fullName.split(' ')[0]} ! 🎬</h1>
    <p>Ton compte est prêt. Tu as <span class="highlight">3 crédits vidéo</span> offerts pour commencer.</p>
    <p>Crée ta première vidéo en moins de 10 minutes :</p>
    <a href="${FRONTEND_URL}/dashboard" class="btn">Accéder à mon dashboard →</a>
    <p style="margin-top: 24px;">Des questions ? Réponds à cet email, on est là pour t'aider.</p>
  `)

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: '🎬 Bienvenue sur CLYRO — 3 vidéos gratuites t\'attendent',
      html,
    })

    if (error) {
      logger.error({ error, to }, 'Resend: failed to send welcome email')
      throw new Error(`Failed to send welcome email: ${error.message}`)
    }

    logger.info({ to }, 'Resend: welcome email sent')
  } catch (err) {
    logger.error({ err, to }, 'Resend: welcome email error')
    throw err
  }
}

/**
 * Email de notification — vidéo prête
 */
export async function sendVideoReadyEmail(
  to: string,
  videoTitle: string,
  downloadUrl: string
): Promise<void> {
  const resend = getResendClient()

  const html = baseTemplate(`
    <h1>Ta vidéo est prête ! 🎉</h1>
    <p>Bonne nouvelle — <span class="highlight">"${videoTitle}"</span> a été générée avec succès.</p>
    <p>Télécharge ta vidéo MP4 dès maintenant :</p>
    <a href="${downloadUrl}" class="btn">Télécharger ma vidéo →</a>
    <p style="margin-top: 24px; font-size: 14px; color: #4A5568;">
      Le lien est valide 7 jours. Tu peux aussi retrouver ta vidéo dans ton historique.
    </p>
  `)

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `🎬 Ta vidéo "${videoTitle}" est prête !`,
      html,
    })

    if (error) {
      logger.error({ error, to }, 'Resend: failed to send video ready email')
      throw new Error(`Failed to send video ready email: ${error.message}`)
    }

    logger.info({ to, videoTitle }, 'Resend: video ready email sent')
  } catch (err) {
    logger.error({ err, to }, 'Resend: video ready email error')
    throw err
  }
}

/**
 * Email de notification — brand kit prêt
 */
export async function sendBrandKitReadyEmail(
  to: string,
  brandName: string,
  downloadUrl: string
): Promise<void> {
  const resend = getResendClient()

  const html = baseTemplate(`
    <h1>Ton brand kit est prêt ! 🎨</h1>
    <p>Bonne nouvelle — le kit d'identité visuelle pour <span class="highlight">"${brandName}"</span> a été généré avec succès.</p>
    <p>Il contient tes logos, ta palette couleurs, tes mockups et ta charte graphique complète.</p>
    <a href="${downloadUrl}" class="btn">Télécharger mon brand kit →</a>
    <p style="margin-top: 24px; font-size: 14px; color: #4A5568;">
      Le lien de téléchargement est valide 1 an. Tu peux aussi retrouver ton kit dans ton dashboard.
    </p>
  `)

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `🎨 Ton brand kit "${brandName}" est prêt !`,
      html,
    })

    if (error) {
      logger.error({ error, to }, 'Resend: failed to send brand kit ready email')
      throw new Error(`Failed to send brand kit ready email: ${error.message}`)
    }

    logger.info({ to, brandName }, 'Resend: brand kit ready email sent')
  } catch (err) {
    logger.error({ err, to }, 'Resend: brand kit ready email error')
    throw err
  }
}

/**
 * Email de confirmation de paiement
 */
export async function sendPaymentConfirmationEmail(
  to: string,
  plan: string,
  amount: number,
  currency: string
): Promise<void> {
  const resend = getResendClient()

  const formattedAmount = new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(amount)

  const html = baseTemplate(`
    <h1>Paiement confirmé ✅</h1>
    <p>Merci pour ton abonnement au plan <span class="highlight">${plan.charAt(0).toUpperCase() + plan.slice(1)}</span>.</p>
    <p>Montant débité : <span class="highlight">${formattedAmount}</span></p>
    <p>Tes crédits ont été ajoutés à ton compte. Tu peux commencer à créer dès maintenant !</p>
    <a href="${FRONTEND_URL}/dashboard" class="btn">Créer ma première vidéo →</a>
    <p style="margin-top: 24px; font-size: 14px; color: #4A5568;">
      Ta facture sera envoyée séparément. Pour toute question, contacte support@clyro.app.
    </p>
  `)

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `✅ Confirmation de paiement — Plan ${plan} CLYRO`,
      html,
    })

    if (error) {
      logger.error({ error, to }, 'Resend: failed to send payment confirmation')
      throw new Error(`Failed to send payment confirmation: ${error.message}`)
    }

    logger.info({ to, plan }, 'Resend: payment confirmation sent')
  } catch (err) {
    logger.error({ err, to }, 'Resend: payment confirmation error')
    throw err
  }
}
