import { Link } from 'react-router-dom'
import { AlertCircle, Moon, BookOpen, CalendarRange } from 'lucide-react'
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
        <Stat to="/tasks?filter=overdue" icon={AlertCircle} value={counts.overdue || 0} label="Overdue" tone="bg-red-50 text-red-500" />
        <Stat to="/tasks?filter=tonight" icon={Moon} value={counts.dueToday || 0} label="Tonight" tone="bg-amber-50 text-amber-500" />
        <Stat to="/tasks?filter=homework_tonight" icon={BookOpen} value={counts.homeworkTonight || 0} label="HW tonight" tone="bg-indigo-50 text-indigo-600" />
        <Stat to="/tasks?filter=week" icon={CalendarRange} value={(counts.dueToday || 0) + (counts.dueThisWeek || 0)} label="This week" tone="bg-emerald-50 text-emerald-600" />
      </div>
    </div>
  )
}
