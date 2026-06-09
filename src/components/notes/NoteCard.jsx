import { Pin } from 'lucide-react'
import { Card } from '../ui/Card'
import { IconButton } from '../ui/IconButton'
import { cn } from '../../lib/cn'
import { formatDate } from '../../lib/format'

/** A sticky-style note tile. Click to edit; pin toggles to the top. */
export function NoteCard({ note, onOpen, onTogglePin }) {
  return (
    <Card interactive className="flex flex-col p-4" onClick={() => onOpen(note)}>
      <div className="mb-1 flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-800">
          {note.title || 'Untitled note'}
        </h3>
        <IconButton
          label={note.pinned ? 'Unpin' : 'Pin'}
          active={note.pinned}
          onClick={(e) => { e.stopPropagation(); onTogglePin(note) }}
          className="-mr-1 -mt-1 h-7 w-7"
        >
          <Pin className={cn('h-3.5 w-3.5', note.pinned && 'fill-current')} />
        </IconButton>
      </div>
      <p className="line-clamp-5 whitespace-pre-wrap text-sm text-zinc-500">{note.body || 'Empty'}</p>
      <p className="mt-3 text-[11px] text-zinc-400">{formatDate(note.updated_at, 'MMM d')}</p>
    </Card>
  )
}
