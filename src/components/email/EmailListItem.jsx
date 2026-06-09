import { Pin } from 'lucide-react'
import { IconButton, Badge } from '../ui'
import { cn } from '../../lib/cn'
import { formatDate, formatTime } from '../../lib/format'

/** One email row in the list. Bold subject when unread; pin toggle; needs-reply badge. */
export function EmailListItem({ email, selected, onSelect, onTogglePin }) {
  const unread = !email.is_read

  // A clickable div (not <button>) so the pin IconButton can nest legally.
  const onKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(email) }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(email)}
      onKeyDown={onKeyDown}
      className={cn(
        'group w-full cursor-pointer px-4 py-3 text-left transition-colors focus-ring',
        selected ? 'bg-accent-50' : 'hover:bg-zinc-50',
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        {/* Unread dot */}
        <span
          aria-label={unread ? 'Unread' : undefined}
          className={cn(
            'mt-1.5 h-2 w-2 shrink-0 rounded-full',
            unread ? 'bg-accent-500' : 'bg-transparent',
          )}
        />

        <div className="min-w-0 flex-1">
          {/* Row 1: sender + time */}
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <span className={cn('truncate text-sm', unread ? 'font-semibold text-zinc-900' : 'font-medium text-zinc-700')}>
              {email.from_name || email.from_email}
            </span>
            <span className="shrink-0 text-[11px] text-zinc-400">
              {formatDate(email.received_at, 'MMM d')}
              {' '}
              {formatTime(email.received_at)}
            </span>
          </div>

          {/* Row 2: subject */}
          <p className={cn('truncate text-sm', unread ? 'font-medium text-zinc-800' : 'text-zinc-600')}>
            {email.subject || '(no subject)'}
          </p>

          {/* Row 3: snippet + badges + pin */}
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="truncate text-xs text-zinc-400">{email.snippet}</p>
            <div className="flex shrink-0 items-center gap-1">
              {email.needs_reply && (
                <Badge tone="amber">Reply</Badge>
              )}
              <IconButton
                label={email.pinned ? 'Unpin email' : 'Pin email'}
                active={email.pinned}
                onClick={(e) => { e.stopPropagation(); onTogglePin(email) }}
                className="h-6 w-6 opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                <Pin className={cn('h-3.5 w-3.5', email.pinned && 'fill-current')} />
              </IconButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
