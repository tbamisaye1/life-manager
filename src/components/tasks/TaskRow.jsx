import { Repeat } from 'lucide-react'
import { Checkbox } from '../ui/Checkbox'
import { DeadlineBadge } from '../ui/DeadlineBadge'
import { ProjectTag } from '../ui/ProjectTag'
import { cn } from '../../lib/cn'

const RECURRENCE_LABEL = { daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

/** One task row — checkbox, title, project, deadline badge. Notion-style. */
export function TaskRow({ task, onToggle, onOpen }) {
  const done = task.status === 'done'
  return (
    <div className="group flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-zinc-50">
      <Checkbox checked={done} onChange={() => onToggle(task)} label={`Complete ${task.title}`} />

      <button
        type="button"
        onClick={() => onOpen(task)}
        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-ring rounded"
      >
        {task.emoji && <span className="shrink-0 text-sm">{task.emoji}</span>}
        <span className={cn('truncate text-sm', done ? 'text-zinc-400 line-through' : 'text-zinc-800')}>
          {task.title}
        </span>
        {task.recurrence && task.recurrence !== 'single' && (
          <span className="hidden shrink-0 items-center gap-1 text-xs text-zinc-400 sm:flex">
            <Repeat className="h-3 w-3" /> {RECURRENCE_LABEL[task.recurrence]}
          </span>
        )}
      </button>

      <div className="flex shrink-0 items-center gap-2">
        {task.project_code && <ProjectTag code={task.project_code} color={task.project_color} className="hidden md:inline-flex" />}
        <DeadlineBadge date={task.due_date} done={done} />
      </div>
    </div>
  )
}
