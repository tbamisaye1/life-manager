import { Star, AlertCircle, Sun, CalendarRange, CalendarClock, CheckCircle2 } from 'lucide-react'

// Filter definitions for the tasks list. Kept in a non-component module so the
// component file only exports a component (React Fast Refresh requirement).
export const TASK_FILTERS = [
  { key: 'all', label: 'All', icon: Star },
  { key: 'overdue', label: 'Past Due', icon: AlertCircle },
  { key: 'today', label: 'Today', icon: Sun },
  { key: 'week', label: 'This Week', icon: CalendarRange },
  { key: 'upcoming', label: 'Upcoming', icon: CalendarClock },
  { key: 'done', label: 'Completed', icon: CheckCircle2 },
]
