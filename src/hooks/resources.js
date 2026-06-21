import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { createResource } from './createResource'

// Standard CRUD resources. `related` keys keep cross-surface data in sync:
// changing a task refreshes Today; logging work refreshes projects; etc.
export const tasks = createResource('tasks', '/tasks', ['today', 'projects'])
export const projects = createResource('projects', '/projects', ['today'])
export const events = createResource('events', '/events', ['today'])
export const improvements = createResource('improvements', '/improvements')
export const notes = createResource('notes', '/notes')
export const emails = createResource('emails', '/emails', ['today'])
export const replyQueue = createResource('reply-queue', '/reply-queue', ['today'])
export const favorites = createResource('favorites', '/favorites')
// The curated "I'm Bored" list — fully user-editable.
export const boredItems = createResource('bored-items', '/bored-items')
export const pins = createResource('pins', '/pins')

// --- Priorities: standard CRUD + a "check off for this period" action ---
export const priorities = createResource('priorities', '/priorities', ['today'])
export function useCheckPriority() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.post(`/priorities/${id}/check`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: ['priorities'] })
      client.invalidateQueries({ queryKey: ['today'] })
    },
  })
}

// --- Dashboard reads ---
export const useToday = () => useQuery({ queryKey: ['today'], queryFn: () => api.get('/today') })
// Pages flagged "focus" that should appear on the Bored page.
export const useFocusPages = () => useQuery({ queryKey: ['bored'], queryFn: () => api.get('/bored') })
export const useRecents = () => useQuery({ queryKey: ['recents'], queryFn: () => api.get('/favorites/recents') })
