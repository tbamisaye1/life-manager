import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

const qs = (params) => {
  if (!params) return ''
  const entries = Object.entries(params).filter(([, v]) => v != null && v !== '')
  if (!entries.length) return ''
  return '?' + new URLSearchParams(entries).toString()
}

/**
 * Build a standard set of CRUD hooks for a REST resource. `related` is a list
 * of extra query keys to invalidate on writes (e.g. tasks writes refresh the
 * 'today' dashboard) — this is how a change in one place propagates everywhere.
 */
export function createResource(key, basePath, related = []) {
  const invalidateAll = (client) => {
    client.invalidateQueries({ queryKey: [key] })
    related.forEach((k) => client.invalidateQueries({ queryKey: [k] }))
  }

  const useList = (params) =>
    useQuery({ queryKey: [key, params || null], queryFn: () => api.get(`${basePath}${qs(params)}`) })

  const useItem = (id) =>
    useQuery({ queryKey: [key, 'item', id], queryFn: () => api.get(`${basePath}/${id}`), enabled: !!id })

  const useCreate = () => {
    const client = useQueryClient()
    return useMutation({ mutationFn: (body) => api.post(basePath, body), onSuccess: () => invalidateAll(client) })
  }

  const useUpdate = () => {
    const client = useQueryClient()
    return useMutation({
      mutationFn: ({ id, ...body }) => api.patch(`${basePath}/${id}`, body),
      onSuccess: () => invalidateAll(client),
    })
  }

  const useRemove = () => {
    const client = useQueryClient()
    return useMutation({ mutationFn: (id) => api.del(`${basePath}/${id}`), onSuccess: () => invalidateAll(client) })
  }

  return { key, basePath, useList, useItem, useCreate, useUpdate, useRemove, invalidateAll }
}
