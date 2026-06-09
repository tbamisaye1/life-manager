import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'
import { Badge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'

/** Summary tile for one improvement goal. Links to its own page. */
export function ImprovementCard({ improvement }) {
  const { id, emoji, title, summary, category, progress, action_count, action_done } = improvement
  return (
    <Link to={`/improvements/${id}`}>
      <Card interactive className="flex h-full flex-col p-5">
        <div className="flex items-start gap-3">
          <span className="text-2xl">{emoji}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-semibold text-zinc-900">{title}</h3>
            {category && <Badge tone="accent" className="mt-1 capitalize">{category}</Badge>}
          </div>
        </div>
        {summary && <p className="mt-3 line-clamp-2 text-sm text-zinc-500">{summary}</p>}
        <div className="mt-auto pt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-zinc-400">
            <span>{progress}%</span>
            {action_count > 0 && <span>{action_done}/{action_count} actions</span>}
          </div>
          <ProgressBar value={progress} />
        </div>
      </Card>
    </Link>
  )
}
