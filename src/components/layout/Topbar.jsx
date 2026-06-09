import { useState, useEffect } from 'react'
import { Plus, Search, Star } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button, IconButton } from '../ui'
import { cn } from '../../lib/cn'
import { navMeta } from '../../lib/nav'
import { nameOfIcon } from '../../lib/icons'
import { SearchPalette } from '../search/SearchPalette'
import { PriorityPin } from './PriorityPin'
import { useFavorites } from '../../hooks/useFavorites'

// Top bar: section title + favorite star + global search + priority pin + quick-add.
export function Topbar({ onQuickAdd }) {
  const { pathname } = useLocation()
  const meta = navMeta(pathname)
  const title = meta?.label || 'Life Manager'

  const [searchOpen, setSearchOpen] = useState(false)
  const { isFavorite, toggle } = useFavorites()

  // Global ⌘K / Ctrl+K listener — always opens search, even when typing.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Favorite the current page (only meaningful for the primary nav routes).
  const favved = isFavorite(pathname)
  const onToggleFav = () => toggle({ path: pathname, label: title, icon: meta ? nameOfIcon(meta.icon) : 'Star' })

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 border-b border-zinc-200 bg-white/80 px-6 backdrop-blur">
        {/* Left: section title + favorite star */}
        <div className="flex min-w-0 items-center gap-1.5">
          {meta?.icon && <meta.icon className="h-4 w-4 shrink-0 text-zinc-400" />}
          <span className="truncate text-base font-semibold text-zinc-900">{title}</span>
          {meta && (
            <IconButton label={favved ? 'Remove from favorites' : 'Add to favorites'} active={favved} onClick={onToggleFav} className="h-7 w-7">
              <Star className={cn('h-4 w-4', favved && 'fill-amber-400 text-amber-400')} />
            </IconButton>
          )}
        </div>

        {/* Center: search trigger */}
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-2 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-400 transition-colors hover:border-zinc-300 hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500"
          aria-label="Open search"
        >
          <Search className="h-3.5 w-3.5 shrink-0" />
          <span className="hidden sm:inline">Search…</span>
          <kbd className="hidden rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-500 sm:inline">⌘K</kbd>
        </button>

        {/* Right: priority pin + quick-add */}
        <div className="flex shrink-0 items-center gap-2">
          <PriorityPin />
          <Button variant="primary" size="sm" onClick={onQuickAdd}>
            <Plus className="h-4 w-4" /> New
          </Button>
        </div>
      </header>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
