import { useEffect, useRef } from 'react'
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

// ─── Microsoft / Outlook: multiple accounts + calendars ─────────────────────────

export const useMicrosoftAccounts = () =>
  useQuery({ queryKey: ['microsoft', 'accounts'], queryFn: () => api.get('/integrations/microsoft/accounts') })

export const useMicrosoftCalendars = () =>
  useQuery({ queryKey: ['microsoft', 'calendars'], queryFn: () => api.get('/integrations/microsoft/calendars') })

function refreshMicrosoft(client) {
  client.invalidateQueries({ queryKey: ['microsoft'] })
  client.invalidateQueries({ queryKey: ['integrations'] })
  client.invalidateQueries({ queryKey: ['events'] })
}

export function useMicrosoftCalendarActions() {
  const client = useQueryClient()
  const toggleCalendar = useMutation({
    mutationFn: ({ id, selected }) => api.post(`/integrations/microsoft/calendars/${encodeURIComponent(id)}/selected`, { selected }),
    onSuccess: () => refreshMicrosoft(client),
  })
  const setDefault = useMutation({
    mutationFn: (email) => api.post(`/integrations/microsoft/accounts/${encodeURIComponent(email)}/default`, {}),
    onSuccess: () => refreshMicrosoft(client),
  })
  const disconnectAccount = useMutation({
    mutationFn: (email) => api.del(`/integrations/microsoft/accounts/${encodeURIComponent(email)}`),
    onSuccess: () => refreshMicrosoft(client),
  })
  const sync = useMutation({
    mutationFn: () => api.post('/integrations/microsoft/sync', {}),
    onSuccess: () => refreshMicrosoft(client),
  })
  return { toggleCalendar, setDefault, disconnectAccount, sync }
}

// Quietly pull the latest calendar events when a view mounts or the window
// regains focus — throttled so we don't hammer the API.
const AUTO_SYNC_THROTTLE_MS = 2 * 60 * 1000
let lastAutoSyncAt = 0

export function useGoogleAutoSync(enabled, syncMutation) {
  useCalendarAutoSync(enabled, syncMutation)
}

export function useMicrosoftAutoSync(enabled, syncMutation) {
  useCalendarAutoSync(enabled, syncMutation)
}

function useCalendarAutoSync(enabled, syncMutation) {
  const syncRef = useRef(syncMutation)
  useEffect(() => {
    syncRef.current = syncMutation
  })
  useEffect(() => {
    if (!enabled) return
    const maybeSync = () => {
      if (document.visibilityState === 'hidden') return
      if (syncRef.current.isPending) return
      if (Date.now() - lastAutoSyncAt < AUTO_SYNC_THROTTLE_MS) return
      lastAutoSyncAt = Date.now()
      syncRef.current.mutate()
    }
    maybeSync()
    window.addEventListener('focus', maybeSync)
    document.addEventListener('visibilitychange', maybeSync)
    return () => {
      window.removeEventListener('focus', maybeSync)
      document.removeEventListener('visibilitychange', maybeSync)
    }
  }, [enabled])
}
