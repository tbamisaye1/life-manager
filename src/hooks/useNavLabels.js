import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { navMeta, resolveItemLabel } from '../lib/nav'

const KEY = ['nav-labels']

export function useNavLabels() {
  return useQuery({ queryKey: KEY, queryFn: () => api.get('/settings/nav-labels') })
}

export function useNavLabel(path) {
  const { data } = useNavLabels()
  const meta = navMeta(path)
  return resolveItemLabel(path, meta?.label, data)
}

export function useRenameNavLabel() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (patch) => api.patch('/settings/nav-labels', patch),
    onSuccess: (data) => {
      client.setQueryData(KEY, data)
      client.invalidateQueries({ queryKey: ['recents'] })
      client.invalidateQueries({ queryKey: ['favorites'] })
    },
  })
}

/** Clear a custom sidebar label (revert to default). */
export function useResetNavLabel() {
  const rename = useRenameNavLabel()
  return (path) => rename.mutate({ items: { [path]: '' } })
}
