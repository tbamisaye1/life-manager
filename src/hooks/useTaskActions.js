import { tasks } from './resources'

/** Shared toggle so Today, Tasks, and project pages complete tasks identically. */
export function useToggleTask() {
  const update = tasks.useUpdate()
  return (task) => update.mutate({ id: task.id, status: task.status === 'done' ? 'todo' : 'done' })
}
