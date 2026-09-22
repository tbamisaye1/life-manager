import {
  Star,
  AlertCircle,
  Moon,
  CalendarRange,
  BookOpen,
  BookMarked,
  CheckCircle2,
  GraduationCap,
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

export const EXAM_FILTER_GROUPS = [
  {
    id: 'exams',
    filters: [
      { key: 'exam_upcoming', label: 'Upcoming', icon: GraduationCap },
      { key: 'exam_week', label: 'This Week', icon: CalendarRange },
      { key: 'exam_tonight', label: 'Today', icon: Moon },
      { key: 'exam_overdue', label: 'Past Due', icon: AlertCircle },
      { key: 'exam', label: 'All Exams', icon: GraduationCap },
    ],
  },
  {
    id: 'done',
    filters: [{ key: 'done', label: 'Completed', icon: CheckCircle2 }],
  },
]

export const EXAM_FILTERS = EXAM_FILTER_GROUPS.flatMap((g) => g.filters)

export const QUICK_DAY_OPTIONS = [2, 3, 4, 5, 7, 14]
