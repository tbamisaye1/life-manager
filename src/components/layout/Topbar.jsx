import { useState, useEffect } from 'react'
import { Plus, Search } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '../ui'
import { navMeta } from '../../lib/nav'
import { SearchPalette } from '../search/SearchPalette'

// Lightweight top bar: current section name + global search trigger + quick-add.
export function Topbar({ onQuickAdd }) {
  const { pathname } = useLocation()
  const meta = navMeta(pathname)
  const title = meta?.label || 'Life Manager'

  const [searchOpen, setSearchOpen] = useState(false)

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

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur">
        {/* Left: section title */}
        <div className="flex items-center gap-2">
          {meta?.icon && <meta.icon className="h-4 w-4 text-zinc-400" />}
          <span className="text-base font-semibold text-zinc-900">{title}</span>
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
          <kbd className="hidden rounded bg-zinc-200 px-1.5 py-0.5 font-mono text-[10px] leading-none text-zinc-500 sm:inline">
            ⌘K
          </kbd>
        </button>

        {/* Right: quick-add */}
        <Button variant="primary" size="sm" onClick={onQuickAdd}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </header>

      <SearchPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  )
}
