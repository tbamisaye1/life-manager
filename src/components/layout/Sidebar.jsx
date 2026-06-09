import { Command } from 'lucide-react'
import { NAV_SECTIONS, SETTINGS_ITEM } from '../../lib/nav'
import { useToday } from '../../hooks/resources'
import { SidebarSection } from './SidebarSection'
import { SidebarLink } from './SidebarLink'
import { FavoritesNav } from './FavoritesNav'

// Per-route badge counts (e.g. overdue tasks, replies owed) come from Today.
function useNavBadges() {
  const { data } = useToday()
  const c = data?.counts || {}
  return {
    '/tasks': c.overdue,
    '/email': c.needsReply,
    '/replies': c.replyQueue,
  }
}

export function Sidebar() {
  const badges = useNavBadges()
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-100/60">
      <div className="flex items-center gap-2 px-4 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent-600 text-white">
          <Command className="h-4 w-4" />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-zinc-900">Life Manager</p>
          <p className="text-[11px] text-zinc-400">Everything in one place</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto pb-4">
        <FavoritesNav />
        {NAV_SECTIONS.map((section) => (
          <SidebarSection key={section.label} label={section.label}>
            {section.items.map((item) => (
              <SidebarLink key={item.path} to={item.path} icon={item.icon} label={item.label} badge={badges[item.path]} />
            ))}
          </SidebarSection>
        ))}
      </nav>

      <div className="border-t border-zinc-200 p-2">
        <SidebarLink to={SETTINGS_ITEM.path} icon={SETTINGS_ITEM.icon} label={SETTINGS_ITEM.label} />
      </div>
    </aside>
  )
}
