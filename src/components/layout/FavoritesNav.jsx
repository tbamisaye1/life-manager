import { Star } from 'lucide-react'
import { favorites as favoritesResource, useRecents } from '../../hooks/resources'
import { iconByName } from '../../lib/icons'
import { SidebarSection } from './SidebarSection'
import { SidebarLink } from './SidebarLink'

/** Notion-style Favorites + Recents groups in the sidebar. */
export function FavoritesNav() {
  const { data: favorites = [] } = favoritesResource.useList()
  const { data: recents = [] } = useRecents()

  return (
    <>
      {favorites.length > 0 && (
        <SidebarSection label="Favorites">
          {favorites.map((f) => (
            <SidebarLink key={f.id} to={f.path} icon={iconByName(f.icon)} label={f.label} />
          ))}
        </SidebarSection>
      )}

      {recents.length > 0 && (
        <SidebarSection label="Recent">
          {recents.slice(0, 5).map((r) => (
            <SidebarLink key={r.path} to={r.path} icon={iconByName(r.icon) || Star} label={r.label} />
          ))}
        </SidebarSection>
      )}
    </>
  )
}
