import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

/** Single improvement (with its action items) + mutations for its actions. */
export function useImprovement(id) {
  return useQuery({ queryKey: ['improvements', 'item', id], queryFn: () => api.get(`/improvements/${id}`), enabled: !!id })
}

export function useImprovementActions(id) {
  const client = useQueryClient()
  const invalidate = () => {
    client.invalidateQueries({ queryKey: ['improvements', 'item', id] })
    client.invalidateQueries({ queryKey: ['improvements'] })
    client.invalidateQueries({ queryKey: ['bored'] })
  }
  return {
    add: useMutation({ mutationFn: (text) => api.post(`/improvements/${id}/actions`, { text }), onSuccess: invalidate }),
    toggle: useMutation({ mutationFn: ({ actionId, done }) => api.patch(`/improvements/${id}/actions/${actionId}`, { done }), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (actionId) => api.del(`/improvements/${id}/actions/${actionId}`), onSuccess: invalidate }),
  }
}
