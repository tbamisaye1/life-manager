import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

const invalidate = (client) => {
  client.invalidateQueries({ queryKey: ['rugby-sessions'] })
  client.invalidateQueries({ queryKey: ['rugby-skills'] })
}

export const useRugbySessions = () =>
  useQuery({ queryKey: ['rugby-sessions'], queryFn: () => api.get('/rugby/sessions') })

export const useRugbySkills = () =>
  useQuery({ queryKey: ['rugby-skills'], queryFn: () => api.get('/rugby/skills') })

export function useCreateSession() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (body) => api.post('/rugby/sessions', body), onSuccess: () => invalidate(client) })
}

export function useUpdateSkill() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/rugby/skills/${id}`, body),
    onSuccess: () => invalidate(client),
  })
}

export function useCreateSkill() {
  const client = useQueryClient()
  return useMutation({ mutationFn: (body) => api.post('/rugby/skills', body), onSuccess: () => invalidate(client) })
}
