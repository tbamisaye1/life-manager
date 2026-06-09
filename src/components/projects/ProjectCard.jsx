import { Link } from 'react-router-dom'
import { formatDistanceToNow, parseISO, differenceInCalendarDays } from 'date-fns'
import { Card } from '../ui/Card'
import { ColorDot } from '../ui/ProjectTag'
import { cn } from '../../lib/cn'

// "Worked 2 days ago" + a staleness tint so neglected jobs stand out.
function lastWorked(iso) {
  if (!iso) return { text: 'Not logged yet', stale: true }
  const days = differenceInCalendarDays(new Date(), parseISO(iso))
  return { text: `Worked ${formatDistanceToNow(parseISO(iso), { addSuffix: true })}`, stale: days >= 5 }
}

export function ProjectCard({ project }) {
  const lw = lastWorked(project.last_worked_at)
  return (
    <Link to={`/projects/${project.id}`}>
      <Card interactive className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{project.emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-zinc-900">{project.name}</h3>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-zinc-400">
              <ColorDot color={project.color} />
              {project.short_code}
            </div>
          </div>
        </div>
        {project.description && <p className="mt-3 line-clamp-2 text-sm text-zinc-500">{project.description}</p>}
        <div className="mt-auto flex items-center justify-between pt-4 text-xs">
          <span className={cn('font-medium', lw.stale ? 'text-amber-600' : 'text-zinc-400')}>{lw.text}</span>
          {project.open_tasks > 0 && (
            <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-500">{project.open_tasks} open</span>
          )}
        </div>
      </Card>
    </Link>
  )
}
