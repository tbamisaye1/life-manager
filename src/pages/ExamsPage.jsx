import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { differenceInCalendarDays, format, parseISO } from 'date-fns'
import { GraduationCap } from 'lucide-react'
import { NavPageHeader, EmptyState, Loading, ErrorState, Card, CardBody } from '../components/ui'
import { TaskFilters } from '../components/tasks/TaskFilters'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetailModal } from '../components/tasks/TaskDetailModal'
import { EXAM_FILTER_GROUPS, EXAM_FILTERS } from '../components/tasks/taskFilterConfig'
import { tasks as tasksResource } from '../hooks/resources'
import { useToggleTask } from '../hooks/useTaskActions'
import { cn } from '../lib/cn'
import {
  examCounts,
  filterTasks,
  isValidTaskFilter,
  parseNextFilter,
} from '../lib/taskFilters'

const PRESET_KEYS = EXAM_FILTERS.map((f) => f.key)
const EXAM_SCOPES = [{ key: 'exam', label: 'Exams' }]

function countdownLabel(due) {
  if (!due) return null
  const days = differenceInCalendarDays(parseISO(due), new Date())
  const when = format(parseISO(due), due.includes('T') ? 'EEE MMM d · h:mm a' : 'EEE MMM d')
  if (days < 0) return { tone: 'overdue', headline: 'Overdue', sub: when, days }
  if (days === 0) return { tone: 'today', headline: 'Today', sub: when, days }
  if (days === 1) return { tone: 'soon', headline: 'Tomorrow', sub: when, days }
  return { tone: 'upcoming', headline: `${days} days`, sub: when, days }
}

function filterLabel(filter) {
  const next = parseNextFilter(filter)
  if (next) {
    const unit = next.days === 1 ? 'day' : 'days'
    return `No exams in the next ${next.days} ${unit}.`
  }
  if (filter === 'done') return 'No completed exams yet.'
  if (filter === 'exam_overdue') return 'No overdue exams.'
  if (filter === 'exam_tonight') return 'No exams today.'
  if (filter === 'exam_week') return 'No exams in the next 7 days.'
  return 'Mark a task as Exam to see it here.'
}

export default function ExamsPage() {
  const [params, setParams] = useSearchParams()
  const filterFromUrl = params.get('filter')
  const filter = isValidTaskFilter(filterFromUrl, PRESET_KEYS) ? filterFromUrl : 'exam_upcoming'
  const [selected, setSelected] = useState(null)
  const { data: tasks = [], isLoading, isError, refetch } = tasksResource.useList()
  const toggle = useToggleTask()

  const setFilter = (next) => {
    const nextParams = new URLSearchParams(params)
    if (next === 'exam_upcoming') nextParams.delete('filter')
    else nextParams.set('filter', next)
    setParams(nextParams, { replace: true })
  }

  const examTasks = useMemo(
    () => tasks.filter((t) => Number(t.is_exam) === 1 || t.is_exam === true),
    [tasks],
  )
  const visible = useMemo(() => {
    if (filter === 'done') return filterTasks(examTasks, 'done')
    if (parseNextFilter(filter)) return filterTasks(tasks, filter)
    return filterTasks(tasks, filter)
  }, [tasks, examTasks, filter])
  const counts = useMemo(() => examCounts(tasks), [tasks])
  const nextExam = useMemo(() => {
    return examTasks
      .filter((t) => t.status !== 'done' && t.due_date)
      .slice()
      .sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)))[0]
  }, [examTasks])
  const nextMeta = nextExam ? countdownLabel(nextExam.due_date) : null

  if (isLoading) return <Loading label="Loading exams…" />
  if (isError) return <ErrorState message="Couldn't load exams" onRetry={refetch} />

  return (
    <div>
      <NavPageHeader
        path="/exams"
        subtitle="Upcoming midterms and finals — countdown first, then the full list."
        icon={GraduationCap}
      />

      {nextExam && nextMeta && (
        <Card
          className={cn(
            'mb-5 overflow-hidden border-l-[3px]',
            nextMeta.tone === 'overdue' && 'border-l-red-500',
            nextMeta.tone === 'today' && 'border-l-amber-500',
            nextMeta.tone === 'soon' && 'border-l-orange-400',
            nextMeta.tone === 'upcoming' && 'border-l-accent-500',
          )}
        >
          <CardBody className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Next exam</p>
              <button
                type="button"
                onClick={() => setSelected(nextExam)}
                className="mt-1 text-left focus-ring rounded"
              >
                <p className="font-serif text-2xl tracking-tight text-zinc-900">
                  {nextExam.emoji ? `${nextExam.emoji} ` : ''}
                  {nextExam.title}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{nextMeta.sub}</p>
              </button>
            </div>
            <div className="text-right">
              <p
                className={cn(
                  'text-3xl font-semibold tabular-nums tracking-tight',
                  nextMeta.tone === 'overdue' && 'text-red-600',
                  nextMeta.tone === 'today' && 'text-amber-600',
                  nextMeta.tone === 'soon' && 'text-orange-500',
                  nextMeta.tone === 'upcoming' && 'text-accent-700',
                )}
              >
                {nextMeta.headline}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {counts.exam_week} this week · {counts.exam_upcoming} upcoming
              </p>
            </div>
          </CardBody>
        </Card>
      )}

      <div className="mb-5">
        <TaskFilters
          value={filter}
          onChange={setFilter}
          counts={counts}
          tasks={tasks}
          groups={EXAM_FILTER_GROUPS}
          defaultScope="exam"
          scopes={EXAM_SCOPES}
        />
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={GraduationCap}
          title={filter === 'done' ? 'Nothing completed yet' : 'No exams here'}
          description={filterLabel(filter)}
        />
      ) : (
        <TaskList tasks={visible} onToggle={toggle} onOpen={setSelected} />
      )}

      <TaskDetailModal key={selected?.id} task={selected} open={!!selected} onClose={() => setSelected(null)} />
    </div>
  )
}
