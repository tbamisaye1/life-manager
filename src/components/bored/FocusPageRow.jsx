import { Link } from 'react-router-dom'
import { ArrowRight, FileText, X } from 'lucide-react'
import { Card } from '../ui/Card'
import { IconButton } from '../ui/IconButton'
import { cn } from '../../lib/cn'

/** A notes page flagged for the Bored page — navigate to open, X to unflag. */
export function FocusPageRow({ page, onRemove }) {
  const remove = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (window.confirm(`Remove “${page.title}” from flagged pages?`)) onRemove(page.id)
  }

  return (
    <Card interactive className="group flex items-center gap-3 p-3">
      <Link to={`/notes/${page.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <span className="text-lg">{page.icon || <FileText className="h-4 w-4 text-zinc-400" />}</span>
        <span className="flex-1 truncate text-sm font-medium text-zinc-700">{page.title}</span>
        <ArrowRight className="h-4 w-4 text-zinc-400" />
      </Link>
      <IconButton
        label="Remove from flagged pages"
        onClick={remove}
        className={cn('shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100')}
      >
        <X className="h-3.5 w-3.5" />
      </IconButton>
    </Card>
  )
}
