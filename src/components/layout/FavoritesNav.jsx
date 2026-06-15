import { Star } from 'lucide-react'
import { favorites as favoritesResource, useRecents } from '../../hooks/resources'
import { iconByName } from '../../lib/icons'
import { navMeta, resolveItemLabel, resolveSectionLabel } from '../../lib/nav'
import { SidebarSection } from './SidebarSection'
import { SidebarLink } from './SidebarLink'

const FAVORITES_KEY = 'Favorites'
const RECENT_KEY = 'Recent'

/** Notion-style Favorites + Recents groups in the sidebar. */
export function FavoritesNav({
  labels = { items: {}, sections: {} },
  onRenameSection,
  getNavProps,
}) {
  const { data: favorites = [] } = favoritesResource.useList()
  const { data: recents = [] } = useRecents()

  const favoritesLabel = resolveSectionLabel(FAVORITES_KEY, labels)
  const recentLabel = resolveSectionLabel(RECENT_KEY, labels)

  const propsForPath = (path, fallbackLabel) => {
    const meta = navMeta(path)
    const label = resolveItemLabel(path, fallbackLabel, labels)
    return getNavProps?.(path, label, meta) || {}
  }

  return (
    <>
      {favorites.length > 0 && (
        <SidebarSection
          label={favoritesLabel}
          onRenameLabel={onRenameSection?.(FAVORITES_KEY)}
        >
          {favorites.map((f) => {
            const label = resolveItemLabel(f.path, f.label, labels)
            return (
              <SidebarLink
                key={f.id}
                editKey={`fav-${f.id}`}
                to={f.path}
                icon={iconByName(f.icon)}
                label={label}
                {...propsForPath(f.path, f.label)}
              />
            )
          })}
        </SidebarSection>
      )}

      {recents.length > 0 && (
        <SidebarSection
          label={recentLabel}
          onRenameLabel={onRenameSection?.(RECENT_KEY)}
        >
          {recents.slice(0, 5).map((r) => {
            const label = resolveItemLabel(r.path, r.label, labels)
            return (
              <SidebarLink
                key={`recent-${r.path}`}
                editKey={`recent-${r.path}`}
                to={r.path}
                icon={iconByName(r.icon) || Star}
                label={label}
                {...propsForPath(r.path, r.label)}
              />
            )
          })}
        </SidebarSection>
      )}
    </>
  )
}
