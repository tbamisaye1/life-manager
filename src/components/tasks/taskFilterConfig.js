import {
  Star,
  AlertCircle,
  Moon,
  CalendarRange,
  BookOpen,
  BookMarked,
  CheckCircle2,
} from 'lucide-react'

// Filter definitions for the tasks list. Kept in a non-component module so the
// component file only exports a component (React Fast Refresh requirement).
export const TASK_FILTER_GROUPS = [
  {
    id: 'timing',
    filters: [
      { key: 'all', label: 'All', icon: Star },
      { key: 'overdue', label: 'Past Due', icon: AlertCircle },
      { key: 'tonight', label: 'Tonight', icon: Moon },
      { key: 'week', label: 'This Week', icon: CalendarRange },
    ],
  },
  {
    id: 'homework',
    filters: [
      { key: 'homework_tonight', label: 'HW Tonight', icon: BookMarked },
      { key: 'homework_week', label: 'HW This Week', icon: BookOpen },
      { key: 'homework', label: 'All Homework', icon: BookOpen },
    ],
  },
  {
    id: 'done',
    filters: [{ key: 'done', label: 'Completed', icon: CheckCircle2 }],
  },
]

export const TASK_FILTERS = TASK_FILTER_GROUPS.flatMap((g) => g.filters)

export const QUICK_DAY_OPTIONS = [2, 3, 4, 5, 7, 14]
