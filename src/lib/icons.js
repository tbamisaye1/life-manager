// Resolve an icon name string (stored in the DB for favorites/recents) to a
// lucide component, with a sensible fallback.
import {
  Sun, CheckSquare, Calendar, ListChecks, Sparkles, TrendingUp, FolderKanban,
  Mail, StickyNote, MessageSquare, Dumbbell, Settings, Star, FileText, Rocket,
} from 'lucide-react'

const REGISTRY = {
  Sun, CheckSquare, Calendar, ListChecks, Sparkles, TrendingUp, FolderKanban,
  Mail, StickyNote, MessageSquare, Dumbbell, Settings, Star, FileText, Rocket,
}

export function iconByName(name) {
  return REGISTRY[name] || Star
}
