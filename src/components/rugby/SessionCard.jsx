import { MapPin, Star } from 'lucide-react'
import { Card, CardBody, Badge } from '../ui'
import { formatDate } from '../../lib/format'
import { StatPill } from './StatPill'

const METRIC_LABELS = {
  tackles: 'Tackles',
  turnovers: 'Turnovers',
  meters: 'Meters',
  tries: 'Tries',
  minutes: 'Minutes',
  sprints: 'Sprints',
}

/** Session card showing date, type badge, game details, rating, metric pills, and notes. */
export function SessionCard({ session }) {
  const { date, type, opponent, position, rating, metrics = {}, notes } = session

  const isGame = type === 'game'
  const metricEntries = Object.entries(metrics).filter(
    ([key, val]) => METRIC_LABELS[key] && val !== null && val !== undefined && val !== '',
  )

  return (
    <Card>
      <CardBody className="p-4">
        {/* Header row */}
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-medium text-zinc-400">{formatDate(date)}</span>
            <Badge tone={isGame ? 'blue' : 'neutral'} className="capitalize">
              {isGame ? 'Game' : 'Training'}
            </Badge>
            {isGame && opponent && (
              <span className="truncate text-sm font-semibold text-zinc-800">vs {opponent}</span>
            )}
          </div>
          {rating != null && (
            <div className="flex shrink-0 items-center gap-1 text-sm font-semibold text-zinc-700">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {rating}/10
            </div>
          )}
        </div>

        {/* Position */}
        {isGame && position && (
          <div className="mb-3 flex items-center gap-1 text-xs text-zinc-500">
            <MapPin className="h-3 w-3" />
            {position}
          </div>
        )}

        {/* Metric pills */}
        {metricEntries.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {metricEntries.map(([key, val]) => (
              <StatPill key={key} label={METRIC_LABELS[key]} value={val} />
            ))}
          </div>
        )}

        {/* Notes */}
        {notes && (
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">{notes}</p>
        )}
      </CardBody>
    </Card>
  )
}
