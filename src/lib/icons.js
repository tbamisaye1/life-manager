// Resolve an icon name string (stored in the DB for favorites/recents) to a
// lucide component, with a sensible fallback.
import {
  Sun, CheckSquare, Calendar, ListChecks, Sparkles, TrendingUp, FolderKanban,
  Mail, StickyNote, MessageSquare, Dumbbell, Settings, Star, FileText, Rocket,
  Bot, CalendarClock, Trophy,
} from 'lucide-react'

const REGISTRY = {
  Sun, CheckSquare, Calendar, ListChecks, Sparkles, TrendingUp, FolderKanban,
  Mail, StickyNote, MessageSquare, Dumbbell, Settings, Star, FileText, Rocket,
  Bot, CalendarClock, Trophy,
}

export function iconByName(name) {
  return REGISTRY[name] || Star
}

// Reverse lookup: a lucide component -> its registry name string (for storing
// favorites). Falls back to 'Star'. Avoids relying on component.displayName.
const NAME_BY_COMPONENT = new Map(Object.entries(REGISTRY).map(([k, v]) => [v, k]))
export function nameOfIcon(component) {
  return NAME_BY_COMPONENT.get(component) || 'Star'
}
