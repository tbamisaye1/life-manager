import {
  CheckSquare,
  Calendar,
  FolderKanban,
  FileText,
  TrendingUp,
  ListChecks,
  Sparkles,
  Mail,
  Dumbbell,
} from 'lucide-react'
import { cn } from '../../lib/cn'

const TYPE_ICONS = {
  task: CheckSquare,
  event: Calendar,
  project: FolderKanban,
  page: FileText,
  improvement: TrendingUp,
  priority: ListChecks,
  bored: Sparkles,
  email: Mail,
  exercise: Dumbbell,
}

const TYPE_LABELS = {
  task: 'Task',
  event: 'Event',
  project: 'Project',
  page: 'Page',
  improvement: 'Improvement',
  priority: 'Priority',
  bored: "I'm Bored",
  email: 'Email',
  exercise: 'Exercise',
}

/**
 * One row in the search palette results list.
 * `active` — keyboard-selected state.
 * `result` — { type, id, title, subtitle, path, icon? }
 */
export function SearchResultItem({ result, active, onClick, ...rest }) {
  const { type, title, subtitle, icon } = result
  const LucideIcon = TYPE_ICONS[type] ?? FileText
  const typeLabel = TYPE_LABELS[type] ?? type

  return (
    <button
      type="button"
      onClick={onClick}
      {...rest}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors',
        active ? 'bg-accent-50 text-zinc-900' : 'text-zinc-700 hover:bg-zinc-50',
      )}
    >
      {/* Type icon or page emoji */}
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-400">
        {icon ? (
          <span className="text-base leading-none">{icon}</span>
        ) : (
          <LucideIcon className="h-3.5 w-3.5" />
        )}
      </span>

      {/* Title + subtitle */}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium leading-snug">{title}</span>
        {subtitle && (
          <span className="block truncate text-xs text-zinc-400 leading-snug">{subtitle}</span>
        )}
      </span>

      {/* Type label chip */}
      <span className="shrink-0 rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500">
        {typeLabel}
      </span>
    </button>
  )
}
