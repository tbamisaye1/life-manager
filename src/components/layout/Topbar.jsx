import { Plus } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { Button } from '../ui'
import { navMeta } from '../../lib/nav'

// Lightweight top bar: current section name + the global quick-add button.
export function Topbar({ onQuickAdd }) {
  const { pathname } = useLocation()
  const meta = navMeta(pathname)
  const title = meta?.label || 'Life Manager'

  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white/80 px-6 backdrop-blur">
      <div className="flex items-center gap-2 text-sm">
        {meta?.icon && <meta.icon className="h-4 w-4 text-zinc-400" />}
        <span className="font-medium text-zinc-700">{title}</span>
      </div>
      <Button variant="primary" size="sm" onClick={onQuickAdd}>
        <Plus className="h-4 w-4" /> New
      </Button>
    </header>
  )
}
