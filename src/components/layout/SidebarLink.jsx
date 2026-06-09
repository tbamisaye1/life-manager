import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'

/** A single sidebar navigation row. Highlights when its route is active. */
export function SidebarLink({ to, icon: Icon, label, end = false, badge }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'group flex items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors focus-ring',
          isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-800',
        )
      }
    >
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
      <span className="truncate">{label}</span>
      {badge != null && badge > 0 && (
        <span className="ml-auto rounded-full bg-zinc-200 px-1.5 text-xs font-semibold text-zinc-600 group-hover:bg-zinc-300">
          {badge}
        </span>
      )}
    </NavLink>
  )
}
