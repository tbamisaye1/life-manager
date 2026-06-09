import { favorites as favResource } from './resources'

/**
 * Dynamic favorites: read the list and toggle the current page in/out.
 * Favorites are keyed by route `path`; icon is stored as a lucide name string.
 */
export function useFavorites() {
  const { data: favorites = [] } = favResource.useList()
  const create = favResource.useCreate()
  const remove = favResource.useRemove()

  const find = (path) => favorites.find((f) => f.path === path)

  return {
    favorites,
    isFavorite: (path) => Boolean(find(path)),
    toggle: ({ path, label, icon }) => {
      const existing = find(path)
      if (existing) remove.mutate(existing.id)
      else create.mutate({ path, label, icon })
    },
  }
}
