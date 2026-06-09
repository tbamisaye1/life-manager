import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

/** Returns { data: { configured: boolean }, isLoading, isError } */
export function useAssistantStatus() {
  return useQuery({
    queryKey: ['assistant-status'],
    queryFn: () => api.get('/assistant/status'),
    staleTime: 60_000,
  })
}

/**
 * Sends the full messages array to the assistant endpoint.
 * On success, broadly invalidates all queries so any created events/tasks
 * appear immediately in Today, Tasks, Calendar, etc.
 *
 * mutate({ messages: [{ role, content }] })
 * → { reply: string, actions: string[], configured: boolean }
 */
export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ messages }) => api.post('/assistant/chat', { messages }),
    onSuccess: () => {
      // Broadly invalidate so any side-effects (created events/tasks/bored items)
      // surface immediately across all pages.
      queryClient.invalidateQueries()
    },
  })
}
