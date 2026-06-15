import {
  Sun, Bot, CalendarClock, CheckSquare, Calendar, ListChecks, Sparkles, TrendingUp,
  FolderKanban, Mail, StickyNote, MessageSquare, Dumbbell, Trophy, Settings,
} from 'lucide-react'

// Single source of truth for primary navigation. Sidebar renders from this,
// and the shell uses it to resolve page titles for the "recents" list.
export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { path: '/today', label: 'Today', icon: Sun },
      { path: '/assistant', label: 'Assistant', icon: Bot },
      { path: '/schedule', label: 'Daily Schedule', icon: CalendarClock },
      { path: '/calendar', label: 'Calendar', icon: Calendar },
      { path: '/tasks', label: 'Tasks', icon: CheckSquare },
      { path: '/notes', label: 'Notes & Ideas', icon: StickyNote },
      { path: '/priorities', label: 'Daily Priorities', icon: ListChecks },
    ],
  },
  {
    label: 'Focus',
    items: [
      { path: '/bored', label: "I'm Bored", icon: Sparkles },
      { path: '/improvements', label: 'Improvements', icon: TrendingUp },
      { path: '/projects', label: 'Projects & Jobs', icon: FolderKanban },
      { path: '/gym', label: 'Gym & Rehab', icon: Dumbbell },
      { path: '/rugby', label: 'Rugby', icon: Trophy },
    ],
  },
  {
    label: 'Inbox',
    items: [
      { path: '/email', label: 'Email', icon: Mail },
      { path: '/replies', label: 'Reply Queue', icon: MessageSquare },
    ],
  },
]

export const SETTINGS_ITEM = { path: '/settings', label: 'Settings & Sync', icon: Settings }

// Flat lookup: path -> { label, icon } for recents, breadcrumbs, favorites star.
const FLAT = {}
for (const section of NAV_SECTIONS) {
  for (const item of section.items) FLAT[item.path] = item
}
FLAT[SETTINGS_ITEM.path] = SETTINGS_ITEM

export function navMeta(path) {
  return FLAT[path] || null
}

export function resolveItemLabel(path, defaultLabel, labels) {
  return labels?.items?.[path] || defaultLabel || ''
}

export function resolveSectionLabel(defaultLabel, labels) {
  return labels?.sections?.[defaultLabel] || defaultLabel || ''
}

/** Nav sections with user-custom labels applied (for sidebar rendering). */
export function buildNavSections(labels) {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    defaultLabel: section.label,
    label: resolveSectionLabel(section.label, labels),
    items: section.items.map((item) => ({
      ...item,
      defaultLabel: item.label,
      label: resolveItemLabel(item.path, item.label, labels),
    })),
  }))
}

export function buildSettingsItem(labels) {
  return {
    ...SETTINGS_ITEM,
    defaultLabel: SETTINGS_ITEM.label,
    label: resolveItemLabel(SETTINGS_ITEM.path, SETTINGS_ITEM.label, labels),
  }
}
