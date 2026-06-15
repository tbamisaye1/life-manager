import { useRef, useEffect } from 'react'
import { Send, Square, X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui'

/**
 * Bottom composer: auto-growing textarea + send/stop button.
 * - Enter → send
 * - Shift+Enter → newline
 * - While pending: stop button aborts the in-flight request
 * - editingLabel: shown when editing a prior user message for resend
 */
export function ChatComposer({
  value,
  onChange,
  onSend,
  onStop,
  onCancelEdit,
  disabled,
  pending,
  editingLabel,
}) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`
  }, [value])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (pending) {
        onStop?.()
      } else if (!disabled && value.trim()) {
        onSend()
      }
    }
    if (e.key === 'Escape' && editingLabel) {
      e.preventDefault()
      onCancelEdit?.()
    }
  }

  return (
    <div className="space-y-2">
      {editingLabel && (
        <div className="flex items-center justify-between rounded-lg border border-accent-200 bg-accent-50 px-3 py-2 text-xs text-accent-800">
          <span>{editingLabel}</span>
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-accent-700 hover:bg-accent-100"
          >
            <X className="h-3 w-3" />
            Cancel edit
          </button>
        </div>
      )}
      <div className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/20">
        <textarea
          ref={ref}
          rows={1}
          value={value}
          onChange={onChange}
          onKeyDown={handleKeyDown}
          disabled={disabled && !pending}
          placeholder={
            pending
              ? 'Working… press Stop to cancel'
              : editingLabel
                ? 'Edit your message, then send to resend…'
                : 'Ask me to schedule something, add a task, set a reminder…'
          }
          className={cn(
            'flex-1 resize-none bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400',
            'focus:outline-none disabled:opacity-50',
            'leading-relaxed',
          )}
        />
        {pending ? (
          <IconButton
            label="Stop response"
            onClick={onStop}
            className="mb-0.5 shrink-0 bg-red-600 text-white hover:bg-red-700"
          >
            <Square className="h-3.5 w-3.5 fill-current" />
          </IconButton>
        ) : (
          <IconButton
            label="Send message"
            onClick={onSend}
            disabled={disabled || !value.trim()}
            className={cn(
              'mb-0.5 shrink-0',
              value.trim() && !disabled
                ? 'bg-accent-600 text-white hover:bg-accent-700'
                : 'text-zinc-300',
            )}
          >
            <Send className="h-4 w-4" />
          </IconButton>
        )}
      </div>
    </div>
  )
}
