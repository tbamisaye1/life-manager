import { Link } from 'react-router-dom'
import { Card } from '../ui/Card'

/** A titled section with an optional count and "view all" link, wrapping a list. */
export function SectionCard({ title, icon: Icon, count, to, action, children }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-4 w-4 text-zinc-400" />}
          <h2 className="text-sm font-semibold text-zinc-700">{title}</h2>
          {count != null && <span className="text-sm text-zinc-400">{count}</span>}
        </div>
        {to ? (
          <Link to={to} className="text-xs font-medium text-accent-600 hover:underline focus-ring">View all</Link>
        ) : action || null}
      </div>
      <Card className="overflow-hidden">{children}</Card>
    </section>
  )
}
