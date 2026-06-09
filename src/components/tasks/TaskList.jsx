import { Card } from '../ui/Card'
import { TaskRow } from './TaskRow'

/** A bordered card listing task rows with hairline dividers. */
export function TaskList({ tasks, onToggle, onOpen }) {
  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-zinc-100">
        {tasks.map((task) => (
          <TaskRow key={task.id} task={task} onToggle={onToggle} onOpen={onOpen} />
        ))}
      </div>
    </Card>
  )
}
