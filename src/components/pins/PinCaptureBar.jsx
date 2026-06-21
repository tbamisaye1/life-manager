import { useRef } from 'react'
import { ArrowUp } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui'

/** Always-visible quick capture — Enter to add, no modal required. */
export function PinCaptureBar({ value, onChange, onSubmit, pending }) {
  const inputRef = useRef(null)

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSubmit()
    }
  }

  return (
    <div className="sticky top-0 z-10 -mx-1 mb-5 rounded-2xl border border-zinc-200 bg-white/90 p-2 shadow-sm backdrop-blur-md">
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKey}
          rows={1}
          placeholder="Drop a quick thought… (Enter to save)"
          className="max-h-24 min-h-[44px] flex-1 resize-none bg-transparent px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none"
        />
        <IconButton
          label="Add pin"
          onClick={onSubmit}
          disabled={!value.trim() || pending}
          className={cn(
            'mb-0.5 h-10 w-10 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700',
            'disabled:opacity-40',
          )}
        >
          <ArrowUp className="h-5 w-5" />
        </IconButton>
      </div>
    </div>
  )
}
