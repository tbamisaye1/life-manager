import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

export const useIntegrationStatus = () =>
  useQuery({ queryKey: ['integrations'], queryFn: () => api.get('/integrations/status') })

export function useSyncProvider() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ provider, databaseId }) =>
      api.post(`/integrations/${provider}/sync`, provider === 'notion' ? { databaseId } : undefined),
    onSuccess: () => {
      client.invalidateQueries() // a sync can touch tasks, events, emails — refresh broadly
    },
  })
}

export function useDisconnectProvider() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (provider) => api.del(`/integrations/${provider}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['integrations'] }),
  })
}

// ─── Google: multiple accounts + calendars ──────────────────────────────────────

export const useGoogleAccounts = () =>
  useQuery({ queryKey: ['google', 'accounts'], queryFn: () => api.get('/integrations/google/accounts') })

export const useGoogleCalendars = () =>
  useQuery({ queryKey: ['google', 'calendars'], queryFn: () => api.get('/integrations/google/calendars') })

function refreshGoogle(client) {
  client.invalidateQueries({ queryKey: ['google'] })
  client.invalidateQueries({ queryKey: ['integrations'] })
  client.invalidateQueries({ queryKey: ['events'] })
}

export function useGoogleCalendarActions() {
  const client = useQueryClient()
  const toggleCalendar = useMutation({
    mutationFn: ({ id, selected }) => api.post(`/integrations/google/calendars/${encodeURIComponent(id)}/selected`, { selected }),
    onSuccess: () => refreshGoogle(client),
  })
  const setDefault = useMutation({
    mutationFn: (email) => api.post(`/integrations/google/accounts/${encodeURIComponent(email)}/default`, {}),
    onSuccess: () => refreshGoogle(client),
  })
  const disconnectAccount = useMutation({
    mutationFn: (email) => api.del(`/integrations/google/accounts/${encodeURIComponent(email)}`),
    onSuccess: () => refreshGoogle(client),
  })
  const sync = useMutation({
    mutationFn: () => api.post('/integrations/google/sync', {}),
    onSuccess: () => refreshGoogle(client),
  })
  return { toggleCalendar, setDefault, disconnectAccount, sync }
}
