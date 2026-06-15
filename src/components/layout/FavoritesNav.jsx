import { Star } from 'lucide-react'
import { favorites as favoritesResource, useRecents } from '../../hooks/resources'
import { iconByName } from '../../lib/icons'
import { resolveItemLabel, resolveSectionLabel } from '../../lib/nav'
import { SidebarSection } from './SidebarSection'
import { SidebarLink } from './SidebarLink'

const FAVORITES_KEY = 'Favorites'
const RECENT_KEY = 'Recent'

/** Notion-style Favorites + Recents groups in the sidebar. */
export function FavoritesNav({ labels = { items: {}, sections: {} }, onRenameSection }) {
  const { data: favorites = [] } = favoritesResource.useList()
  const { data: recents = [] } = useRecents()

  const favoritesLabel = resolveSectionLabel(FAVORITES_KEY, labels)
  const recentLabel = resolveSectionLabel(RECENT_KEY, labels)

  return (
    <>
      {favorites.length > 0 && (
        <SidebarSection
          label={favoritesLabel}
          onRenameLabel={onRenameSection?.(FAVORITES_KEY)}
        >
          {favorites.map((f) => (
            <SidebarLink
              key={f.id}
              to={f.path}
              icon={iconByName(f.icon)}
              label={resolveItemLabel(f.path, f.label, labels)}
            />
          ))}
        </SidebarSection>
      )}

      {recents.length > 0 && (
        <SidebarSection
          label={recentLabel}
          onRenameLabel={onRenameSection?.(RECENT_KEY)}
        >
          {recents.slice(0, 5).map((r) => (
            <SidebarLink
              key={r.path}
              to={r.path}
              icon={iconByName(r.icon) || Star}
              label={resolveItemLabel(r.path, r.label, labels)}
            />
          ))}
        </SidebarSection>
      )}
    </>
  )
}
