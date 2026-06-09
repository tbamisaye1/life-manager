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
