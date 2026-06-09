import { useState } from 'react'
import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '../../lib/cn'
import { IconButton, Button, Spinner } from '../ui'
import {
  useConversations,
  useDeleteConversation,
  useRenameConversation,
} from '../../hooks/useAssistant'

/**
 * Left-panel conversation history list.
 *
 * Props:
 *   selectedId  – currently active conversation id (null = new chat)
 *   onSelect(id) – called when user clicks a row (or null to start new)
 */
export function ConversationList({ selectedId, onSelect }) {
  const { data: conversations = [], isLoading } = useConversations()
  const deleteConv = useDeleteConversation()
  const renameConv = useRenameConversation()

  // Track which row is being inline-renamed
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  const startRename = (e, conv) => {
    e.stopPropagation()
    setRenamingId(conv.id)
    setRenameValue(conv.title ?? '')
  }

  const commitRename = (id) => {
    const title = renameValue.trim()
    if (title) {
      renameConv.mutate({ id, title })
    }
    setRenamingId(null)
  }

  const handleDelete = (e, id) => {
    e.stopPropagation()
    if (!window.confirm('Delete this conversation?')) return
    deleteConv.mutate(id, {
      onSuccess: () => {
        if (selectedId === id) onSelect(null)
      },
    })
  }

  return (
    <div className="flex h-full flex-col">
      {/* New chat button */}
      <div className="px-3 pb-3 pt-1">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100"
          onClick={() => onSelect(null)}
        >
          <MessageSquarePlus className="h-4 w-4 shrink-0 text-accent-600" />
          New chat
        </Button>
      </div>

      <div className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        History
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        )}

        {!isLoading && conversations.length === 0 && (
          <p className="px-3 py-4 text-xs text-zinc-400">No conversations yet.</p>
        )}

        {conversations.map((conv) => {
          const isActive = conv.id === selectedId
          const isRenaming = renamingId === conv.id

          return (
            <div
              key={conv.id}
              role="button"
              tabIndex={0}
              onClick={() => !isRenaming && onSelect(conv.id)}
              onKeyDown={(e) => e.key === 'Enter' && !isRenaming && onSelect(conv.id)}
              className={cn(
                'group relative mx-1 mb-0.5 flex cursor-pointer flex-col rounded-lg px-3 py-2',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-500',
                isActive
                  ? 'bg-accent-50 text-accent-900'
                  : 'text-zinc-700 hover:bg-zinc-100',
              )}
            >
              {isRenaming ? (
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={() => commitRename(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') { e.preventDefault(); commitRename(conv.id) }
                    if (e.key === 'Escape') setRenamingId(null)
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full rounded bg-white px-1 py-0.5 text-sm text-zinc-800 outline outline-1 outline-accent-400"
                />
              ) : (
                <>
                  <span className="truncate pr-14 text-sm font-medium leading-snug">
                    {conv.title || 'Untitled'}
                  </span>
                  <span className="text-[11px] text-zinc-400">
                    {conv.updated_at
                      ? formatDistanceToNow(new Date(conv.updated_at), { addSuffix: true })
                      : ''}
                  </span>
                </>
              )}

              {/* Action buttons — shown on hover (or active) */}
              {!isRenaming && (
                <span
                  className={cn(
                    'absolute right-1.5 top-1/2 flex -translate-y-1/2 gap-0.5',
                    'opacity-0 group-hover:opacity-100',
                    isActive && 'opacity-100',
                  )}
                >
                  <IconButton
                    label="Rename conversation"
                    onClick={(e) => startRename(e, conv)}
                    className="h-6 w-6 text-zinc-400 hover:text-zinc-700"
                  >
                    <Pencil className="h-3 w-3" />
                  </IconButton>
                  <IconButton
                    label="Delete conversation"
                    onClick={(e) => handleDelete(e, conv.id)}
                    className="h-6 w-6 text-zinc-400 hover:text-red-600"
                  >
                    <Trash2 className="h-3 w-3" />
                  </IconButton>
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
