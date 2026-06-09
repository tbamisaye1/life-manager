import {
  Sun, CheckSquare, Calendar, ListChecks, Sparkles, TrendingUp,
  FolderKanban, Mail, StickyNote, MessageSquare, Dumbbell, Trophy, Settings,
} from 'lucide-react'

// Single source of truth for primary navigation. Sidebar renders from this,
// and the shell uses it to resolve page titles for the "recents" list.
export const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { path: '/today', label: 'Today', icon: Sun },
      { path: '/calendar', label: 'Calendar', icon: Calendar },
      { path: '/tasks', label: 'Tasks', icon: CheckSquare },
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
      { path: '/notes', label: 'Notes & Ideas', icon: StickyNote },
    ],
  },
]

export const SETTINGS_ITEM = { path: '/settings', label: 'Settings & Sync', icon: Settings }

// Flat lookup: path -> { label, iconName } for recents + breadcrumbs.
const FLAT = {}
for (const section of NAV_SECTIONS) {
  for (const item of section.items) FLAT[item.path] = item
}
FLAT[SETTINGS_ITEM.path] = SETTINGS_ITEM

export function navMeta(path) {
  return FLAT[path] || null
}
