import { Link } from 'react-router-dom'
import { AlertCircle, Sun, Mail, MessageSquare } from 'lucide-react'
import { formatDate } from '../../lib/format'

function greeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 18) return 'Good afternoon'
  return 'Good evening'
}

function Stat({ to, icon: Icon, value, label, tone }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 transition-shadow hover:shadow-sm focus-ring"
    >
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="leading-tight">
        <p className="text-lg font-semibold text-zinc-900">{value}</p>
        <p className="text-xs text-zinc-500">{label}</p>
      </div>
    </Link>
  )
}

/** Greeting + at-a-glance counts at the top of Today. */
export function TodayHero({ counts }) {
  return (
    <div className="mb-6">
      <p className="text-sm text-zinc-400">{formatDate(new Date(), 'EEEE, MMMM d')}</p>
      <h1 className="mt-0.5 text-2xl font-bold tracking-tight text-zinc-900">{greeting()} 👋</h1>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat to="/tasks" icon={AlertCircle} value={counts.overdue} label="Overdue" tone="bg-red-50 text-red-500" />
        <Stat to="/tasks" icon={Sun} value={counts.dueToday} label="Due today" tone="bg-amber-50 text-amber-500" />
        <Stat to="/email" icon={Mail} value={counts.needsReply} label="To reply" tone="bg-blue-50 text-blue-500" />
        <Stat to="/replies" icon={MessageSquare} value={counts.replyQueue} label="Messages" tone="bg-violet-50 text-violet-500" />
      </div>
    </div>
  )
}
