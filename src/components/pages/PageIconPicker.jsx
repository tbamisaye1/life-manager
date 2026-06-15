import { useEffect, useRef, useState } from 'react'
import { Search, Shuffle } from 'lucide-react'
import { cn } from '../../lib/cn'
import {
  addRecentEmoji,
  categoriesWithRecent,
  randomEmoji,
  searchEmojis,
} from '../../lib/emojis'

/**
 * Notion-style emoji picker popover for page icons.
 * Click the trigger to open; pick an emoji or remove the current one.
 */
export function PageIconPicker({ value, onChange, size = 'lg', className }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [activeCat, setActiveCat] = useState('recent')
  const ref = useRef(null)
  const scrollRef = useRef(null)
  const sectionRefs = useRef({})

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const pick = (emoji) => {
    addRecentEmoji(emoji)
    onChange(emoji)
    setOpen(false)
  }

  const remove = () => {
    onChange('')
    setOpen(false)
  }

  const shuffle = () => pick(randomEmoji())

  const categories = categoriesWithRecent()
  const filtered = filter ? searchEmojis(filter) : null

  const jumpTo = (id) => {
    setActiveCat(id)
    sectionRefs.current[id]?.scrollIntoView({ block: 'start' })
  }

  const hasIcon = Boolean(value)

  return (
    <div className={cn('relative inline-flex', className)} ref={ref}>
      <button
        type="button"
        onClick={() => {
          if (!open) setFilter('')
          setOpen(!open)
        }}
        aria-label={hasIcon ? 'Change page icon' : 'Add page icon'}
        className={cn(
          'group/icon flex shrink-0 items-center justify-center rounded-lg transition-colors focus-ring',
          size === 'lg' ? 'h-10 min-w-10 text-3xl' : 'h-7 min-w-7 text-base',
          hasIcon
            ? 'hover:bg-zinc-100'
            : 'border border-dashed border-zinc-200 text-xs text-zinc-400 hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-500',
        )}
      >
        {hasIcon ? (
          <span>{value}</span>
        ) : (
          <span className={cn(size === 'lg' ? 'px-2 text-sm' : 'px-1 text-[11px]')}>Add icon</span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Choose page icon"
          className="absolute left-0 top-full z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-zinc-200/90 bg-white shadow-lg shadow-zinc-900/10"
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-zinc-100 px-3 py-2">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
              <input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter…"
                autoFocus
                className="w-full rounded-md border border-zinc-200 bg-zinc-50 py-1.5 pl-7 pr-2 text-sm text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-300 focus:bg-white focus:outline-none"
              />
            </div>
            <button
              type="button"
              onClick={shuffle}
              aria-label="Random emoji"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100"
            >
              <Shuffle className="h-4 w-4" />
            </button>
            {hasIcon && (
              <button
                type="button"
                onClick={remove}
                className="shrink-0 rounded-md px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700"
              >
                Remove
              </button>
            )}
          </div>

          {/* Emoji grid */}
          <div ref={scrollRef} className="max-h-[280px] overflow-y-auto px-3 py-2">
            {filtered ? (
              filtered.length === 0 ? (
                <p className="py-6 text-center text-sm text-zinc-400">No emojis found</p>
              ) : (
                <div className="grid grid-cols-8 gap-0.5">
                  {filtered.map((emoji) => (
                    <EmojiBtn key={emoji} emoji={emoji} current={value} onPick={pick} />
                  ))}
                </div>
              )
            ) : (
              categories.map((cat) => (
                <section
                  key={cat.id}
                  ref={(el) => { sectionRefs.current[cat.id] = el }}
                  className="mb-3 last:mb-1"
                >
                  <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-zinc-400">
                    {cat.label}
                  </h3>
                  <div className="grid grid-cols-8 gap-0.5">
                    {cat.emojis.map((emoji) => (
                      <EmojiBtn key={`${cat.id}-${emoji}`} emoji={emoji} current={value} onPick={pick} />
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>

          {/* Category tabs */}
          {!filter && (
            <div className="flex items-center justify-around border-t border-zinc-100 px-1 py-1.5">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => jumpTo(cat.id)}
                  aria-label={cat.label}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-md text-base transition-colors',
                    activeCat === cat.id ? 'bg-zinc-100' : 'hover:bg-zinc-50',
                  )}
                >
                  {cat.icon}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function EmojiBtn({ emoji, current, onPick }) {
  return (
    <button
      type="button"
      onClick={() => onPick(emoji)}
      aria-label={`Select ${emoji}`}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-md text-xl transition-colors hover:bg-zinc-100',
        emoji === current && 'bg-accent-50 ring-1 ring-accent-200',
      )}
    >
      {emoji}
    </button>
  )
}
