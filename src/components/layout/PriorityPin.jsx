import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Flame, ChevronDown } from 'lucide-react'
import { cn } from '../../lib/cn'
import { useToday } from '../../hooks/resources'
import { DeadlineBadge } from '../ui/DeadlineBadge'

/**
 * Always-visible header indicator for open high/urgent tasks, so urgent work
 * can't be missed. Click to expand a quick list; clicking a task opens Tasks.
 */
export function PriorityPin() {
  const { data } = useToday()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const pinned = data?.pinned || []
  if (pinned.length === 0) return null

  const hasUrgent = pinned.some((t) => t.priority === 'urgent')

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-ring',
          hasUrgent ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-amber-50 text-amber-700 hover:bg-amber-100',
        )}
      >
        <Flame className="h-4 w-4" />
        {pinned.length}
        <span className="hidden sm:inline">{hasUrgent ? 'urgent' : 'priority'}</span>
        <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-80 rounded-xl border border-zinc-200 bg-white p-1.5 shadow-xl">
            <p className="px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              Needs your attention
            </p>
            <div className="max-h-80 overflow-y-auto">
              {pinned.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { setOpen(false); navigate('/tasks') }}
                  className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left hover:bg-zinc-50 focus-ring"
                >
                  <span className={cn('h-2 w-2 shrink-0 rounded-full', t.priority === 'urgent' ? 'bg-red-500' : 'bg-amber-500')} />
                  <span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{t.emoji} {t.title}</span>
                  {t.due_date && <DeadlineBadge date={t.due_date} />}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
