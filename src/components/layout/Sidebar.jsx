import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ChevronRight, Command } from 'lucide-react'
import { buildNavSections, buildSettingsItem } from '../../lib/nav'
import { useToday } from '../../hooks/resources'
import { useNavLabels, useRenameNavLabel, useResetNavLabel } from '../../hooks/useNavLabels'
import { useFavorites } from '../../hooks/useFavorites'
import { nameOfIcon } from '../../lib/icons'
import { cn } from '../../lib/cn'
import { SidebarSection } from './SidebarSection'
import { SidebarLink } from './SidebarLink'
import { SidebarNotesTree } from './SidebarNotesTree'
import { FavoritesNav } from './FavoritesNav'

const NOTES_PATH = '/notes'
const NOTES_EXPAND_KEY = 'lm.sidebar.notesExpanded'

function readNotesExpanded() {
  try {
    const stored = localStorage.getItem(NOTES_EXPAND_KEY)
    if (stored != null) return stored === '1'
  } catch { /* ignore */ }
  return false
}

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
  const location = useLocation()
  const navigate = useNavigate()
  const notesActive = location.pathname === '/notes' || location.pathname.startsWith('/notes/')
  const [notesExpanded, setNotesExpanded] = useState(readNotesExpanded)
  const showNotesTree = notesExpanded || notesActive
  const { data: labels = { items: {}, sections: {} } } = useNavLabels()
  const rename = useRenameNavLabel()
  const resetLabel = useResetNavLabel()
  const { isFavorite, toggle } = useFavorites()
  const sections = buildNavSections(labels)
  const settings = buildSettingsItem(labels)

  useEffect(() => {
    try { localStorage.setItem(NOTES_EXPAND_KEY, notesExpanded ? '1' : '0') } catch { /* ignore */ }
  }, [notesExpanded])

  const renameItem = (path) => (label) => rename.mutate({ items: { [path]: label } })
  const renameSection = (defaultLabel) => (label) => rename.mutate({ sections: { [defaultLabel]: label } })
  const isCustom = (path) => Boolean(labels.items?.[path])

  const navLinkProps = (item) => ({
    to: item.path,
    icon: item.icon,
    label: item.label,
    badge: badges[item.path],
    onRename: renameItem(item.path),
    onResetName: () => resetLabel(item.path),
    customNamed: isCustom(item.path),
    favved: isFavorite(item.path),
    onToggleFavorite: () => toggle({ path: item.path, label: item.label, icon: nameOfIcon(item.icon) }),
  })

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
        <FavoritesNav labels={labels} onRenameSection={renameSection} />
        {sections.map((section) => (
          <SidebarSection
            key={section.defaultLabel}
            label={section.label}
            onRenameLabel={renameSection(section.defaultLabel)}
          >
            {section.items.map((item) => (
              item.path === NOTES_PATH ? (
                <div key={item.path} className="space-y-0.5">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setNotesExpanded((o) => !o)}
                      aria-label={showNotesTree ? 'Collapse pages' : 'Expand pages'}
                      aria-expanded={showNotesTree}
                      className="absolute left-0.5 top-1/2 z-[1] flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-zinc-400 hover:bg-zinc-200/60 hover:text-zinc-600"
                    >
                      <ChevronRight className={cn('h-3.5 w-3.5 transition-transform duration-150', showNotesTree && 'rotate-90')} />
                    </button>
                    <SidebarLink
                      {...navLinkProps(item)}
                      end={false}
                      menuExtra={[{
                        key: 'new-page',
                        label: 'New page',
                        onSelect: () => navigate('/notes'),
                      }]}
                    />
                  </div>
                  {showNotesTree && (
                    <div className="ml-[22px] border-l border-zinc-200/70 pl-2">
                      <SidebarNotesTree />
                    </div>
                  )}
                </div>
              ) : (
                <SidebarLink key={item.path} {...navLinkProps(item)} />
              )
            ))}
          </SidebarSection>
        ))}
      </nav>

      <div className="border-t border-zinc-200 p-2">
        <SidebarLink {...navLinkProps(settings)} />
      </div>
    </aside>
  )
}
