import type { StudioAvatar } from '@/lib/api'

/** A group of avatars sharing the same base name (e.g. "Annie"). */
export interface AvatarGroup {
  baseName: string
  avatars: StudioAvatar[]
  totalLooks: number
  mainPreview: string
  category: StudioAvatar['category']
}

/**
 * Strip common look/version suffixes to derive the base name of an avatar.
 *
 * Handles the HeyGen naming conventions actually observed in production :
 *   "Annie - Look 2"         → "Annie"
 *   "Annie - Standing"       → "Annie"
 *   "Annie - Hands forward"  → "Annie"
 *   "Annie - Doctor"         → "Annie"
 *   "Annie - Yoga teacher"   → "Annie"
 *   "Annie 2 - Sitting"      → "Annie"
 *   "Annie_Look_2"           → "Annie"
 *   "Annie (v3)"             → "Annie"
 *   "Annie in Black Suit"    → "Annie"
 *   "Tyler Sitting"          → "Tyler"
 *   "Sarah Casual Home"      → "Sarah"
 *   "Marcus_Pro_v2"          → "Marcus_Pro" (intentional — "Pro" is a
 *                              tier marker, not a pose; would risk false
 *                              merges if stripped)
 *
 * Conservative on purpose : we only strip RECOGNISED outfit/pose suffix
 * patterns, never multi-word last names. "Anna Smith" stays "Anna Smith"
 * so it never accidentally bundles with "Anna Johnson". Hyphenated real
 * names ("Jean-Pierre") are preserved because step 3 requires spaces on
 * BOTH sides of the dash.
 */
export function getAvatarBaseName(name: string): string {
  return name
    // 1) trailing parens — "(v3)", "(2024)", "(US English)"
    .replace(/\s*\([^)]*\)\s*$/, '')
    // 2) "in <outfit>" — "Annie in Black Suit" / "Tyler in Casual Wear"
    .replace(/\s+in\s+.+$/i, '')
    // 3) Space-dash-space separator → strip everything after.
    //    HeyGen's canonical pose/look separator: "Annie - Standing",
    //    "Annie 2 - Sitting", "Tom Smith - Looking around". This is
    //    the single biggest contributor to the previous "no grouping"
    //    bug — HeyGen names overwhelmingly use this pattern, and the
    //    old regex only handled the keyword whitelist below.
    //    Requires spaces on both sides so we don't mangle hyphenated
    //    real names like "Jean-Pierre" or "Anne-Marie".
    .replace(/\s+-\s+.+$/, '')
    // 4) "- look N" / "_look_N" — version/look numbering with non-space
    //    separators (e.g. "Annie_Look_2", "Marcus-look3").
    .replace(/[\s_-]+(?:look|style|outfit|version|pose|variant|v)[\s_-]*\d*\s*$/i, '')
    // 5) Trailing pose/outfit keyword without separator — "Tyler Sitting",
    //    "Sarah Casual Home". Expanded keyword list to cover the actual
    //    HeyGen vocabulary (doctor, yoga, hands, looking, etc.) and
    //    accepts dash/underscore separators in addition to space.
    .replace(/[\s_-]+(?:casual|professional|formal|sitting|standing|walking|talking|phone|selfie|home|office|outdoor|doctor|nurse|presenter|news|anchor|teacher|coach|consultant|interview|listening|speaking|looking|hands|gesture|stretched|forward|engaged|yoga|fitness|gym|kitchen|cafe|coffee|park|beach|studio|portrait|crossed|relaxed|smile|smiling|neutral|enthusiastic|serious)\s*\d*\s*$/i, '')
    // 6) Trailing pure digits — "Sarah 3" → "Sarah". Done last so
    //    "Annie 2 - Sitting" first strips " - Sitting" (step 3) then
    //    " 2" (this step), collapsing the whole Annie family.
    .replace(/[\s_-]+\d+\s*$/, '')
    .trim()
}

/**
 * Group avatars into persona bundles.
 *
 * Strategy: bucket by parsed base name (e.g. "Annie"), then within each
 * name bucket split by HeyGen's native `group_id` ONLY when multiple
 * distinct non-empty group_ids coexist — that's HeyGen explicitly telling
 * us two different personas happen to share the same first name.
 *
 * Why not group by `group_id` first (the previous strategy)? In practice
 * HeyGen populates `group_id` inconsistently across its public catalogue —
 * some Annie variants carry a group_id, others don't, and a few packs
 * assign a fresh group_id per look. Using it as the primary key produced
 * orphaned cards (one "Annie" with 7 looks, plus 3 lone "Annie - Sitting"
 * cards alongside it). The base-name parser is now strong enough to be
 * the primary signal; `group_id` only steps in as a tiebreaker.
 */
export function groupAvatarsByName(avatars: StudioAvatar[]): AvatarGroup[] {
  // Pass 1 — bucket by base name (lowercased)
  const nameBuckets = new Map<string, StudioAvatar[]>()
  for (const av of avatars) {
    const key = getAvatarBaseName(av.avatar_name).toLowerCase()
    if (!nameBuckets.has(key)) nameBuckets.set(key, [])
    nameBuckets.get(key)!.push(av)
  }

  // Pass 2 — within each name bucket, split if multiple non-empty group_ids
  // are present. Avatars without a group_id go to the largest sub-bucket
  // so they aggregate with the dominant persona instead of forming a
  // lone third group.
  const finalBuckets: StudioAvatar[][] = []
  for (const bucket of nameBuckets.values()) {
    const distinctGroupIds = new Set(
      bucket.map((a) => a.group_id).filter((g): g is string => !!g),
    )
    if (distinctGroupIds.size <= 1) {
      finalBuckets.push(bucket)
      continue
    }
    // Multiple group_ids → split by group_id, then re-attach un-tagged
    // avatars to the largest sub-bucket.
    const byGid = new Map<string, StudioAvatar[]>()
    const untagged: StudioAvatar[] = []
    for (const av of bucket) {
      if (av.group_id) {
        if (!byGid.has(av.group_id)) byGid.set(av.group_id, [])
        byGid.get(av.group_id)!.push(av)
      } else {
        untagged.push(av)
      }
    }
    const sortedSubs = Array.from(byGid.values()).sort((a, b) => b.length - a.length)
    if (untagged.length > 0 && sortedSubs.length > 0) {
      sortedSubs[0]!.push(...untagged)
    } else if (untagged.length > 0) {
      sortedSubs.push(untagged)
    }
    finalBuckets.push(...sortedSubs)
  }

  return finalBuckets
    .map((list) => {
      const main = list[0]!
      // Total looks = sum of each avatar's looks (min 1 per avatar with no looks array).
      const totalLooks = list.reduce((sum, a) => sum + Math.max(a.looks_count, 1), 0)
      return {
        baseName: getAvatarBaseName(main.avatar_name),
        avatars: list,
        totalLooks,
        mainPreview: main.preview_image_url,
        category: main.category,
      }
    })
    .sort((a, b) => a.baseName.localeCompare(b.baseName))
}
