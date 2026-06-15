import { useRef } from 'react'
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

// ─── Send message (with optional edit/resend + abort) ────────────────────────
/**
 * mutate({ conversationId?, message, editFromMessageId? })
 * → { conversationId, userMessageId, assistantMessageId, reply, actions, configured }
 *
 * cancel() — abort in-flight request and remove the pending user turn server-side
 */
export function useSendMessage() {
  const queryClient = useQueryClient()
  const abortRef = useRef(null)

  const mutation = useMutation({
    mutationFn: async ({ conversationId, message, editFromMessageId }) => {
      const controller = new AbortController()
      abortRef.current = controller
      try {
        return await api.post(
          '/assistant/chat',
          { conversationId, message, editFromMessageId },
          { signal: controller.signal },
        )
      } finally {
        abortRef.current = null
      }
    },
    onSuccess: (data) => {
      const cid = data.conversationId
      queryClient.invalidateQueries({ queryKey: keys.conversations })
      if (cid) {
        queryClient.invalidateQueries({ queryKey: keys.conversation(cid) })
      }
      queryClient.invalidateQueries()
    },
  })

  const cancel = async (conversationId) => {
    abortRef.current?.abort()
    if (conversationId) {
      try {
        await api.post('/assistant/chat/cancel', { conversationId })
        queryClient.invalidateQueries({ queryKey: keys.conversation(conversationId) })
        queryClient.invalidateQueries({ queryKey: keys.conversations })
      } catch {
        // Best-effort — client abort still stops the UI wait
      }
    }
    mutation.reset()
  }

  return { ...mutation, cancel }
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
