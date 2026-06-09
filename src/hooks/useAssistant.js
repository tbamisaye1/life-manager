import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

// ─── Query key factory ────────────────────────────────────────────────────────
const keys = {
  status: ['assistant', 'status'],
  conversations: ['assistant', 'conversations'],
  conversation: (id) => ['assistant', 'conversation', id],
}

// ─── Status ───────────────────────────────────────────────────────────────────
/** Returns { data: { configured: boolean }, isLoading, isError } */
export function useAssistantStatus() {
  return useQuery({
    queryKey: keys.status,
    queryFn: () => api.get('/assistant/status'),
    staleTime: 60_000,
  })
}

// ─── Conversations list ───────────────────────────────────────────────────────
/** Returns [{ id, title, updated_at }] newest-first */
export function useConversations() {
  return useQuery({
    queryKey: keys.conversations,
    queryFn: () => api.get('/assistant/conversations'),
    staleTime: 10_000,
  })
}

// ─── Single conversation (messages) ──────────────────────────────────────────
/** Returns { conversation, messages } when id is truthy */
export function useConversation(id) {
  return useQuery({
    queryKey: keys.conversation(id),
    queryFn: () => api.get(`/assistant/conversations/${id}`),
    enabled: !!id,
    staleTime: 5_000,
  })
}

// ─── Send message ─────────────────────────────────────────────────────────────
/**
 * mutate({ conversationId?, message })
 * → { conversationId, reply, actions, configured }
 */
export function useSendMessage() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ conversationId, message }) =>
      api.post('/assistant/chat', { conversationId, message }),
    onSuccess: (data) => {
      const cid = data.conversationId
      queryClient.invalidateQueries({ queryKey: keys.conversations })
      if (cid) {
        queryClient.invalidateQueries({ queryKey: keys.conversation(cid) })
      }
      // Broadly invalidate so any side-effects (created events/tasks/bored items)
      // surface immediately across all pages.
      queryClient.invalidateQueries()
    },
  })
}

// ─── Delete conversation ──────────────────────────────────────────────────────
/** mutate(id) */
export function useDeleteConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.del(`/assistant/conversations/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.conversations })
    },
  })
}

// ─── Rename conversation ──────────────────────────────────────────────────────
/** mutate({ id, title }) */
export function useRenameConversation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }) => api.patch(`/assistant/conversations/${id}`, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: keys.conversations })
    },
  })
}
