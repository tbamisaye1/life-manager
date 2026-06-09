import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'

// ─── Query key factory ────────────────────────────────────────────────────────
const keys = {
  exercises: (category) => category ? ['gym', 'exercises', category] : ['gym', 'exercises'],
  exerciseHistory: (id) => ['gym', 'history', id],
  routines: () => ['gym', 'routines'],
  schedule: () => ['gym', 'schedule'],
  today: () => ['gym', 'today'],
  workouts: (date) => date ? ['gym', 'workouts', date] : ['gym', 'workouts'],
  workout: (id) => ['gym', 'workout', id],
}

// ─── Invalidation helpers ─────────────────────────────────────────────────────
function invalidateWorkout(client, workoutId) {
  client.invalidateQueries({ queryKey: keys.workout(workoutId) })
  client.invalidateQueries({ queryKey: ['gym', 'history'] })
}

function invalidateWorkoutList(client) {
  client.invalidateQueries({ queryKey: keys.today() })
  client.invalidateQueries({ queryKey: ['gym', 'workouts'] })
}

// ─── Queries ──────────────────────────────────────────────────────────────────
export function useExercises(category) {
  const path = category ? `/gym/exercises?category=${category}` : '/gym/exercises'
  return useQuery({ queryKey: keys.exercises(category), queryFn: () => api.get(path) })
}

export function useExerciseHistory(id) {
  return useQuery({
    queryKey: keys.exerciseHistory(id),
    queryFn: () => api.get(`/gym/exercises/${id}/history`),
    enabled: !!id,
  })
}

export function useRoutines() {
  return useQuery({ queryKey: keys.routines(), queryFn: () => api.get('/gym/routines') })
}

export function useSchedule() {
  return useQuery({ queryKey: keys.schedule(), queryFn: () => api.get('/gym/schedule') })
}

export function useGymToday() {
  return useQuery({ queryKey: keys.today(), queryFn: () => api.get('/gym/today') })
}

export function useWorkout(id) {
  return useQuery({
    queryKey: keys.workout(id),
    queryFn: () => api.get(`/gym/workouts/${id}`),
    enabled: !!id,
  })
}

export function useWorkouts(date) {
  const path = date ? `/gym/workouts?date=${date}` : '/gym/workouts'
  return useQuery({ queryKey: keys.workouts(date), queryFn: () => api.get(path) })
}

// ─── Exercise mutations ───────────────────────────────────────────────────────
export function useCreateExercise() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post('/gym/exercises', body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['gym', 'exercises'] }),
  })
}

export function useUpdateExercise() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/gym/exercises/${id}`, body),
    onSuccess: () => client.invalidateQueries({ queryKey: ['gym', 'exercises'] }),
  })
}

export function useDeleteExercise() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.del(`/gym/exercises/${id}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['gym', 'exercises'] }),
  })
}

// ─── Routine mutations ────────────────────────────────────────────────────────
export function useCreateRoutine() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post('/gym/routines', body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.routines() })
      client.invalidateQueries({ queryKey: keys.schedule() })
    },
  })
}

export function useUpdateRoutine() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/gym/routines/${id}`, body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.routines() })
      client.invalidateQueries({ queryKey: keys.schedule() })
      client.invalidateQueries({ queryKey: keys.today() })
    },
  })
}

export function useDeleteRoutine() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.del(`/gym/routines/${id}`),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: keys.routines() })
      client.invalidateQueries({ queryKey: keys.schedule() })
    },
  })
}

// ─── Routine-exercise mutations ───────────────────────────────────────────────
export function useAddRoutineExercise() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ routineId, ...body }) => api.post(`/gym/routines/${routineId}/exercises`, body),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.routines() }),
  })
}

export function useRemoveRoutineExercise() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ routineId, rexId }) => api.del(`/gym/routines/${routineId}/exercises/${rexId}`),
    onSuccess: () => client.invalidateQueries({ queryKey: keys.routines() }),
  })
}

// ─── Workout mutations ────────────────────────────────────────────────────────
export function useCreateWorkout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body) => api.post('/gym/workouts', body),
    onSuccess: () => invalidateWorkoutList(client),
  })
}

export function useUpdateWorkout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }) => api.patch(`/gym/workouts/${id}`, body),
    onSuccess: (_data, vars) => {
      invalidateWorkoutList(client)
      client.invalidateQueries({ queryKey: keys.workout(vars.id) })
    },
  })
}

export function useDeleteWorkout() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id) => api.del(`/gym/workouts/${id}`),
    onSuccess: () => invalidateWorkoutList(client),
  })
}

// ─── Set mutations ────────────────────────────────────────────────────────────
export function useAddSet() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ workoutId, ...body }) => api.post(`/gym/workouts/${workoutId}/sets`, body),
    onSuccess: (_data, vars) => invalidateWorkout(client, vars.workoutId),
  })
}

export function useUpdateSet() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (vars) => {
      const { setId, workoutId: _wid, ...body } = vars
      return api.patch(`/gym/sets/${setId}`, body)
    },
    onSuccess: (_data, vars) => invalidateWorkout(client, vars.workoutId),
  })
}

export function useDeleteSet() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({ setId }) => api.del(`/gym/sets/${setId}`),
    onSuccess: (_data, vars) => invalidateWorkout(client, vars.workoutId),
  })
}
