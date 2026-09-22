import { Repeat, BookOpen, GraduationCap } from 'lucide-react'
import { Checkbox } from '../ui/Checkbox'
import { DeadlineBadge } from '../ui/DeadlineBadge'
import { ProjectTag } from '../ui/ProjectTag'
import { cn } from '../../lib/cn'
import { formatRecurrenceLabel } from '../../lib/taskRecurrence'

/** One task row — checkbox, title, project, deadline badge. Notion-style. */
export function TaskRow({ task, onToggle, onOpen }) {
  const done = task.status === 'done'
  const homework = Number(task.is_homework) === 1 || task.is_homework === true
  const exam = Number(task.is_exam) === 1 || task.is_exam === true
  const recurrenceLabel = formatRecurrenceLabel(task.recurrence)
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
        {exam && (
          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-rose-50 px-1.5 py-0.5 text-[11px] font-medium text-rose-600 sm:inline-flex">
            <GraduationCap className="h-3 w-3" /> Exam
          </span>
        )}
        {homework && !exam && (
          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 sm:inline-flex">
            <BookOpen className="h-3 w-3" /> HW
          </span>
        )}
        {homework && exam && (
          <span className="hidden shrink-0 items-center gap-1 rounded-md bg-indigo-50 px-1.5 py-0.5 text-[11px] font-medium text-indigo-600 sm:inline-flex">
            <BookOpen className="h-3 w-3" /> HW
          </span>
        )}
        {recurrenceLabel && (
          <span className="hidden shrink-0 items-center gap-1 text-xs text-zinc-400 sm:flex">
            <Repeat className="h-3 w-3" /> {recurrenceLabel}
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
