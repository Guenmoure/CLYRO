import type { StudioAvatar } from '@/lib/api'

/** A group of avatars sharing the same base name (e.g. "Annie"). */
export interface AvatarGroup {
  baseName: string
  avatars: StudioAvatar[]
  totalLooks: number
  mainPreview: string
  category: StudioAvatar['category']
}

/** Strip common look/version suffixes to derive the base name of an avatar. */
export function getAvatarBaseName(name: string): string {
  return name
    .replace(/\s*[-–]\s*(look|style|outfit|version|v)\s*\d*/i, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .trim()
}

/**
 * Group avatars into persona bundles.
 *
 * Preferred strategy: HeyGen's native `group_id` — every variant of the same
 * persona shares one. This is canonical and can't misfire. When `group_id`
 * is missing (older personas, custom uploads), we fall back to regex-based
 * name parsing, which strips "look", "style", "(v2)", etc. suffixes.
 *
 * Using a hybrid key (`group:<id>` vs `name:<base>`) means the two strategies
 * can't accidentally merge — an avatar with group_id "grp_42" never ends up
 * in the same bucket as an unrelated avatar named "grp_42".
 */
export function groupAvatarsByName(avatars: StudioAvatar[]): AvatarGroup[] {
  const map = new Map<string, StudioAvatar[]>()

  for (const av of avatars) {
    const key = av.group_id
      ? `group:${av.group_id}`
      : `name:${getAvatarBaseName(av.avatar_name).toLowerCase()}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(av)
  }

  return Array.from(map.values())
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
