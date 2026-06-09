import { useEffect, useRef, useState, useCallback } from 'react'
import { Search } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Spinner } from '../ui'
import { useSearch } from '../../hooks/useSearch'
import { SearchResultItem } from './SearchResultItem'

/**
 * Inner palette that is always mounted fresh (parent passes a `key` derived
 * from `open`) so state resets automatically on each open.
 */
function PaletteInner({ onClose }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef(null)
  const listRef = useRef(null)
  const navigate = useNavigate()

  const { results, isFetching } = useSearch(query)

  // Autofocus the input on mount (called once per open).
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Scroll the active item into view whenever it changes.
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector('[data-active="true"]')
    active?.scrollIntoView({ block: 'nearest' })
  }, [activeIndex])

  const navigateTo = useCallback(
    (path) => {
      navigate(path)
      onClose()
    },
    [navigate, onClose],
  )

  const onQueryChange = (e) => {
    setQuery(e.target.value)
    setActiveIndex(0)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      const target = results[activeIndex]
      if (target) navigateTo(target.path)
    } else if (e.key === 'Escape') {
      onClose()
    }
  }

  const showResults = results.length > 0
  const showEmpty = query.trim().length >= 1 && !isFetching && results.length === 0

  return (
    <div
      className="w-full max-w-xl rounded-2xl border border-zinc-200 bg-white shadow-xl"
      onClick={(e) => e.stopPropagation()}
      role="dialog"
      aria-modal="true"
      aria-label="Search"
    >
      {/* Input row */}
      <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3">
        <Search className="h-4 w-4 shrink-0 text-zinc-400" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search everything…"
          value={query}
          onChange={onQueryChange}
          onKeyDown={onKeyDown}
          className="min-w-0 flex-1 bg-transparent text-sm text-zinc-800 placeholder:text-zinc-400 focus:outline-none"
        />
        {isFetching && <Spinner />}
      </div>

      {/* Results list */}
      {(showResults || showEmpty) && (
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2" role="listbox">
          {showEmpty && (
            <p className="py-6 text-center text-sm text-zinc-400">
              No results for &ldquo;{query}&rdquo;
            </p>
          )}
          {showResults &&
            results.map((result, i) => (
              <SearchResultItem
                key={`${result.type}-${result.id}`}
                result={result}
                active={i === activeIndex}
                onClick={() => navigateTo(result.path)}
                data-active={String(i === activeIndex)}
              />
            ))}
        </div>
      )}

      {/* Footer hint */}
      <div
        className={cn(
          'flex items-center justify-center border-t border-zinc-100 px-4 py-2',
          !showResults && !showEmpty && 'border-t-0',
        )}
      >
        <span className="text-xs text-zinc-400">
          <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">↑↓</kbd> to navigate
          &nbsp;&middot;&nbsp;
          <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">↵</kbd> to open
          &nbsp;&middot;&nbsp;
          <kbd className="rounded bg-zinc-100 px-1 py-0.5 font-mono text-[10px]">esc</kbd> to close
        </span>
      </div>
    </div>
  )
}

/**
 * Full-screen command-palette overlay.
 * Uses a `key` on PaletteInner so state resets cleanly each time `open` changes.
 */
export function SearchPalette({ open, onClose }) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/30 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <PaletteInner key="search-palette" onClose={onClose} />
    </div>
  )
}
