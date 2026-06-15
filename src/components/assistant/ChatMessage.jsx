import { Pencil } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Badge } from '../ui'

/**
 * A single chat bubble.
 * - user messages: right-aligned, accent-tinted background, optional edit
 * - assistant messages: left-aligned, white card with optional action badges
 */
export function ChatMessage({ role, content, actions = [], onEdit, canEdit }) {
  const isUser = role === 'user'

  return (
    <div className={cn('group flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[80%] flex-col space-y-2', isUser ? 'items-end' : 'items-start')}>
        <div className="relative">
          <div
            className={cn(
              'whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed',
              isUser
                ? 'bg-accent-600 text-white'
                : 'border border-zinc-200 bg-white text-zinc-800 shadow-sm',
            )}
          >
            {content}
          </div>
          {isUser && canEdit && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              title="Edit and resend"
              className="absolute -left-9 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-zinc-400 opacity-0 transition hover:bg-zinc-100 hover:text-zinc-700 group-hover:opacity-100"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {!isUser && actions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-1">
            {actions.map((action, i) => (
              <Badge key={i} tone="green" className="text-xs">
                {action}
              </Badge>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
