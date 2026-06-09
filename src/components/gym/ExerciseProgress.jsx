import { useState } from 'react'
import { TrendingUp } from 'lucide-react'
import { Card, CardBody, Select, Label, EmptyState, Loading, ErrorState } from '../ui'
import { SuggestionChip } from './SuggestionChip'
import { Sparkline } from './Sparkline'
import { useExercises, useExerciseHistory } from '../../hooks/useGym'
import { formatDate } from '../../lib/format'

/** Progress tab: pick an exercise → sparkline + session list + suggestion. */
export function ExerciseProgress() {
  const [selectedId, setSelectedId] = useState('')
  const { data: exercises = [], isLoading: exLoading } = useExercises()
  const {
    data: history,
    isLoading: histLoading,
    isError: histError,
    refetch,
  } = useExerciseHistory(selectedId || null)

  const sessions = history?.sessions ?? []
  const suggestion = history?.suggestion
  const exercise = history?.exercise

  const weights = sessions.map((s) => s.top_weight).filter((w) => w != null)

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="progress-exercise-select">Choose exercise</Label>
        <Select
          id="progress-exercise-select"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={exLoading}
        >
          <option value="">— Select an exercise —</option>
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </Select>
      </div>

      {!selectedId && (
        <EmptyState
          icon={TrendingUp}
          title="Select an exercise"
          description="Pick an exercise above to see your progress over time."
        />
      )}

      {selectedId && histLoading && <Loading label="Loading history…" />}
      {selectedId && histError && <ErrorState message="Couldn't load history" onRetry={refetch} />}

      {selectedId && !histLoading && !histError && history && (
        <>
          {/* Sparkline card */}
          {weights.length >= 2 && (
            <Card>
              <CardBody className="p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    Top weight over time
                  </p>
                  <span className="text-xs text-zinc-400">{sessions.length} sessions</span>
                </div>
                <Sparkline data={weights} width={320} height={48} className="w-full" />
                <div className="mt-1 flex justify-between text-[10px] text-zinc-400">
                  <span>{sessions[0]?.date ? formatDate(sessions[0].date, 'MMM d') : ''}</span>
                  <span>{sessions[sessions.length - 1]?.date ? formatDate(sessions[sessions.length - 1].date, 'MMM d') : ''}</span>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Suggestion */}
          {suggestion && (
            <Card>
              <CardBody className="p-4">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Next session suggestion
                </p>
                <SuggestionChip suggestion={suggestion} unit={exercise?.unit} />
              </CardBody>
            </Card>
          )}

          {/* Session list */}
          {sessions.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No sessions yet"
              description="Log this exercise in a workout to see your history here."
            />
          ) : (
            <Card>
              <CardBody className="p-0">
                <div className="divide-y divide-zinc-100">
                  {sessions.slice().reverse().map((s) => (
                    <div key={s.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-zinc-800">{formatDate(s.date)}</p>
                        <p className="text-xs text-zinc-400">{s.set_count} sets</p>
                      </div>
                      <div className="text-right">
                        {s.top_weight != null && (
                          <p className="text-sm font-semibold text-zinc-800">
                            {s.top_weight}{exercise?.unit}
                          </p>
                        )}
                        {s.volume != null && (
                          <p className="text-xs text-zinc-400">vol {s.volume}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
