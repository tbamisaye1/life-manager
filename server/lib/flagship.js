/** Titles like "[All Hands]" or "[PRKB/England]" — month-calendar markers. */
export function isAutoFlagshipTitle(title) {
  return /^\[[^\]]+\]/.test((title || '').trim())
}

/** Google sync: bracket titles + manually flagged events stay on the month overview. */
export function flagshipFromGoogleEvent(title, existingFlagship) {
  if (isAutoFlagshipTitle(title)) return 1
  if (existingFlagship) return 1
  return 0
}
