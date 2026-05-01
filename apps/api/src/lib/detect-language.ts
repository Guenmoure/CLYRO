/**
 * Re-export from @clyro/shared so existing imports (
 *   import { detectLanguage } from '../lib/detect-language'
 * ) keep working. The implementation now lives in
 * packages/shared/src/detect-language.ts so the Next.js web app can
 * use the same detector without duplication.
 */
export { detectLanguage } from '@clyro/shared'
export type { DetectedLanguage, SupportedLanguage } from '@clyro/shared'
