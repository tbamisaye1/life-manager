import { cn } from '../../lib/cn'
import { Badge } from '../ui'

/**
 * A single chat bubble.
 * - user messages: right-aligned, accent-tinted background
 * - assistant messages: left-aligned, white card with optional action badges
 */
export function ChatMessage({ role, content, actions = [] }) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[80%] flex-col space-y-2', isUser ? 'items-end' : 'items-start')}>
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
