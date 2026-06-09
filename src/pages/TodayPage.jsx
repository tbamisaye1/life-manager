import { useState } from 'react'
import { AlertCircle, Sun, Calendar, ListChecks } from 'lucide-react'
import { Loading, ErrorState, EmptyState } from '../components/ui'
import { SectionCard } from '../components/shared/SectionCard'
import { TodayHero } from '../components/today/TodayHero'
import { ScheduleItem } from '../components/today/ScheduleItem'
import { TaskRow } from '../components/tasks/TaskRow'
import { TaskDetailModal } from '../components/tasks/TaskDetailModal'
import { PriorityItem } from '../components/priorities/PriorityItem'
import { useToday, useCheckPriority } from '../hooks/resources'
import { useToggleTask } from '../hooks/useTaskActions'

export default function TodayPage() {
  const { data, isLoading, isError, refetch } = useToday()
  const [selected, setSelected] = useState(null)
  const toggle = useToggleTask()
  const check = useCheckPriority()

  if (isLoading) return <Loading label="Loading your day…" />
  if (isError) return <ErrorState message="Couldn't load Today" onRetry={refetch} />

  const { events, dueToday, overdue, priorities, counts } = data

  return (
    <div>
      <TodayHero counts={counts} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {overdue.length > 0 && (
            <SectionCard title="Needs attention" icon={AlertCircle} count={overdue.length} to="/tasks">
              <div className="divide-y divide-zinc-100">
                {overdue.slice(0, 5).map((t) => (
                  <TaskRow key={t.id} task={t} onToggle={toggle} onOpen={setSelected} />
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Due today" icon={Sun} count={dueToday.length} to="/tasks">
            {dueToday.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-400">Nothing due today 🎉</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {dueToday.map((t) => <TaskRow key={t.id} task={t} onToggle={toggle} onOpen={setSelected} />)}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="space-y-6">
          <SectionCard title="Today's schedule" icon={Calendar} count={events.length} to="/calendar">
            {events.length === 0 ? (
              <div className="px-3 py-6 text-center text-sm text-zinc-400">No events today</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {events.map((e) => <ScheduleItem key={e.id} event={e} />)}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Daily priorities" icon={ListChecks} to="/priorities">
            {priorities.length === 0 ? (
              <EmptyState title="No priorities yet" className="border-0" />
            ) : (
              <div className="divide-y divide-zinc-100">
                {priorities.map((p) => <PriorityItem key={p.id} priority={p} onCheck={check.mutate} />)}
              </div>
            )}
          </SectionCard>
        </div>
      </div>

      <TaskDetailModal key={selected?.id} task={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
