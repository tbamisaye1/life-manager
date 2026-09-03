import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckSquare } from 'lucide-react'
import { NavPageHeader, EmptyState, Loading, ErrorState } from '../components/ui'
import { TaskFilters } from '../components/tasks/TaskFilters'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetailModal } from '../components/tasks/TaskDetailModal'
import { TASK_FILTERS } from '../components/tasks/taskFilterConfig'
import { tasks as tasksResource } from '../hooks/resources'
import { useToggleTask } from '../hooks/useTaskActions'
import { filterTasks, taskCounts } from '../lib/taskFilters'

const VALID = new Set(TASK_FILTERS.map((f) => f.key))

export default function TasksPage() {
  const [params, setParams] = useSearchParams()
  const filterFromUrl = params.get('filter')
  const filter = VALID.has(filterFromUrl) ? filterFromUrl : 'all'
  const [selected, setSelected] = useState(null)
  const { data: tasks = [], isLoading, isError, refetch } = tasksResource.useList()
  const toggle = useToggleTask()

  const setFilter = (next) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'all') nextParams.delete('filter')
    else nextParams.set('filter', next)
    setParams(nextParams, { replace: true })
  }

  const visible = useMemo(() => filterTasks(tasks, filter), [tasks, filter])
  const counts = useMemo(() => taskCounts(tasks), [tasks])

  if (isLoading) return <Loading label="Loading tasks…" />
  if (isError) return <ErrorState message="Couldn't load tasks" onRetry={refetch} />

  return (
    <div>
      <NavPageHeader
        path="/tasks"
        subtitle="Tonight, this week, and homework — one click away."
        icon={CheckSquare}
      />

      <div className="mb-4">
        <TaskFilters value={filter} onChange={setFilter} counts={counts} />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title={filter === 'done' ? 'Nothing completed yet' : 'All clear here'}
          description={filter === 'all' ? 'Press “n” or the New button to add your first task.' : 'No tasks match this filter.'}
        />
      ) : (
        <TaskList tasks={visible} onToggle={toggle} onOpen={setSelected} />
      )}

      <TaskDetailModal key={selected?.id} task={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
