import { useState } from 'react'
import { CheckSquare } from 'lucide-react'
import { PageHeader, EmptyState, Loading, ErrorState } from '../components/ui'
import { TaskFilters } from '../components/tasks/TaskFilters'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetailModal } from '../components/tasks/TaskDetailModal'
import { tasks as tasksResource } from '../hooks/resources'
import { useToggleTask } from '../hooks/useTaskActions'
import { filterTasks, taskCounts } from '../lib/taskFilters'

export default function TasksPage() {
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const { data: tasks = [], isLoading, isError, refetch } = tasksResource.useList()
  const toggle = useToggleTask()

  if (isLoading) return <Loading label="Loading tasks…" />
  if (isError) return <ErrorState message="Couldn't load tasks" onRetry={refetch} />

  const visible = filterTasks(tasks, filter)
  const counts = taskCounts(tasks)

  return (
    <div>
      <PageHeader
        title="Assignments & Tasks"
        subtitle="Everything you owe, with clear deadlines."
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
