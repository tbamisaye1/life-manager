import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { createResource } from './createResource'

// Standard CRUD resources. `related` keys keep cross-surface data in sync:
// changing a task refreshes Today; logging work refreshes projects; etc.
export const tasks = createResource('tasks', '/tasks', ['today', 'bored', 'projects'])
export const projects = createResource('projects', '/projects', ['today', 'bored'])
export const events = createResource('events', '/events', ['today'])
export const improvements = createResource('improvements', '/improvements', ['bored'])
export const notes = createResource('notes', '/notes')
export const emails = createResource('emails', '/emails', ['today', 'bored'])
export const replyQueue = createResource('reply-queue', '/reply-queue', ['today'])
export const favorites = createResource('favorites', '/favorites')

// --- Priorities: standard CRUD + a "check off for this period" action ---
export const priorities = createResource('priorities', '/priorities', ['today', 'bored'])
export function useCheckPriority() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.post(`/priorities/${id}/check`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['priorities'] })
      client.invalidateQueries({ queryKey: ['today'] })
      client.invalidateQueries({ queryKey: ['bored'] })
    },
  })
}

// --- Dashboard reads ---
export const useToday = () => useQuery({ queryKey: ['today'], queryFn: () => api.get('/today') })
export const useBored = () => useQuery({ queryKey: ['bored'], queryFn: () => api.get('/bored') })
export const useRecents = () => useQuery({ queryKey: ['recents'], queryFn: () => api.get('/favorites/recents') })
