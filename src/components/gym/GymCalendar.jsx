import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameMonth,
  isToday,
  addMonths,
  subMonths,
  format,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '../../lib/cn'
import { Button, IconButton, Loading, ErrorState } from '../ui'
import { useWorkoutsRange } from '../../hooks/useGym'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 2

/** Format a JS Date as YYYY-MM-DD. */
function toDateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Bucket workouts by their date string. */
function bucketWorkouts(workouts) {
  const map = {}
  for (const w of workouts) {
    if (!w.date) continue
    if (!map[w.date]) map[w.date] = []
    map[w.date].push(w)
  }
  return map
}

// ─── Workout chip ─────────────────────────────────────────────────────────────

function WorkoutChip({ workout, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick(workout.id) }}
      title={workout.title}
      className={cn(
        'w-full truncate rounded px-1.5 py-0.5 text-left text-xs font-medium transition-opacity hover:opacity-75',
        workout.completed
          ? 'bg-accent-100 text-accent-700'
          : 'border border-dashed border-accent-200 bg-accent-50 text-accent-600',
      )}
    >
      {workout.title}
    </button>
  )
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function GymDayCell({ date, workouts, isCurrentMonth, onWorkoutClick }) {
  const today = isToday(date)
  const overflow = workouts.length - MAX_CHIPS
  const visible = workouts.slice(0, MAX_CHIPS)

  return (
    <div
      className={cn(
        'min-h-[108px] border-b border-r border-zinc-100 p-1.5 pb-2',
        !isCurrentMonth && 'bg-zinc-50/60',
      )}
    >
      {/* Date number */}
      <div className="mb-1">
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
            today
              ? 'bg-accent-600 text-white'
              : isCurrentMonth
              ? 'text-zinc-700'
              : 'text-zinc-300',
          )}
        >
          {date.getDate()}
        </span>
      </div>

      {/* Workout chips */}
      <div className="space-y-0.5">
        {visible.map((w) => (
          <WorkoutChip key={w.id} workout={w} onClick={onWorkoutClick} />
        ))}
        {overflow > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onWorkoutClick(workouts[MAX_CHIPS].id) }}
            className="w-full px-1.5 text-left text-xs text-zinc-400 hover:text-zinc-600"
          >
            +{overflow} more
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Main calendar ────────────────────────────────────────────────────────────

export function GymCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => startOfMonth(new Date()))
  const navigate = useNavigate()

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })

  const from = toDateStr(gridStart)
  const to = toDateStr(gridEnd)

  const { data: workouts = [], isLoading, isError, refetch } = useWorkoutsRange(from, to)

  const bucketed = bucketWorkouts(workouts)
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd })

  function handlePrev() { setCurrentMonth((m) => subMonths(m, 1)) }
  function handleNext() { setCurrentMonth((m) => addMonths(m, 1)) }
  function handleToday() { setCurrentMonth(startOfMonth(new Date())) }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-zinc-900">
          {format(currentMonth, 'MMMM yyyy')}
        </h2>
        <div className="flex items-center gap-1">
          <Button size="sm" onClick={handleToday}>Today</Button>
          <IconButton label="Previous month" onClick={handlePrev}>
            <ChevronLeft className="h-4 w-4" />
          </IconButton>
          <IconButton label="Next month" onClick={handleNext}>
            <ChevronRight className="h-4 w-4" />
          </IconButton>
        </div>
      </div>

      {/* Grid */}
      {isLoading ? (
        <Loading label="Loading workouts…" />
      ) : isError ? (
        <ErrorState message="Could not load workouts." onRetry={refetch} />
      ) : (
        <div className="rounded-xl border border-zinc-200 overflow-hidden bg-white shadow-sm">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-zinc-100">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-zinc-400"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7">
            {days.map((date) => (
              <GymDayCell
                key={date.toISOString()}
                date={date}
                workouts={bucketed[toDateStr(date)] || []}
                isCurrentMonth={isSameMonth(date, currentMonth)}
                onWorkoutClick={(id) => navigate(`/gym/workout/${id}`)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
