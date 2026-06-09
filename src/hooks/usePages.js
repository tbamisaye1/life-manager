import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

/** Flat list of all pages (the tree is built client-side from parent_id). */
export const usePages = () => useQuery({ queryKey: ['pages'], queryFn: () => api.get('/pages') })

/** A single page with its body + breadcrumb trail. */
export const usePage = (id) =>
  useQuery({ queryKey: ['pages', 'item', id], queryFn: () => api.get(`/pages/${id}`), enabled: !!id })

export function useCreatePage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post('/pages', body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['pages'] }),
  })
}

export function useUpdatePage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/pages/${id}`, body),
    onSuccess: (_data, vars) => {
      client.invalidateQueries({ queryKey: ['pages'] })
      client.invalidateQueries({ queryKey: ['pages', 'item', vars.id] })
      client.invalidateQueries({ queryKey: ['bored'] })
    },
  })
}

export function useDeletePage() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.del(`/pages/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['pages'] })
      client.invalidateQueries({ queryKey: ['bored'] })
    },
  })
}

/** Build a parent→children tree from the flat page list. */
export function buildPageTree(pages) {
  const byParent = new Map()
  for (const p of pages) {
    const key = p.parent_id || 'root'
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(p)
  }
  const attach = (parentKey) =>
    (byParent.get(parentKey) || []).map((p) => ({ ...p, children: attach(p.id) }))
  return attach('root')
}
