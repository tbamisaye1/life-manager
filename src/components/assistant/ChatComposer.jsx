import { useRef, useEffect } from 'react'
import { Send } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui'

/**
 * Bottom composer: auto-growing textarea + send button.
 * - Enter → send
 * - Shift+Enter → newline
 * - Disabled while the assistant is pending
 */
export function ChatComposer({ value, onChange, onSend, disabled }) {
  const ref = useRef(null)

  // Auto-grow the textarea up to ~6 lines
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`
  }, [value])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!disabled && value.trim()) onSend()
    }
  }

  return (
    <div className="flex items-end gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-sm focus-within:border-accent-500 focus-within:ring-2 focus-within:ring-accent-500/20">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Ask me to schedule something, add a task, set a reminder…"
        className={cn(
          'flex-1 resize-none bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400',
          'focus:outline-none disabled:opacity-50',
          'leading-relaxed',
        )}
      />
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
    </div>
  )
}
