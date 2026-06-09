import { Card, CardBody } from '../ui'
import { cn } from '../../lib/cn'
import { colorClasses } from '../../lib/colors'

// Mon-first display; map to API weekday (0=Sun..6=Sat)
const WEEK_DAYS = [
  { label: 'Mon', weekday: 1 },
  { label: 'Tue', weekday: 2 },
  { label: 'Wed', weekday: 3 },
  { label: 'Thu', weekday: 4 },
  { label: 'Fri', weekday: 5 },
  { label: 'Sat', weekday: 6 },
  { label: 'Sun', weekday: 0 },
]

/** Mon–Sun week view showing each day's assigned routine(s). */
export function WeekSchedule({ schedule }) {
  // schedule.days: [{weekday, routines:[{id,name,emoji,color}]}]
  const dayMap = {}
  if (schedule?.days) {
    for (const d of schedule.days) {
      dayMap[d.weekday] = d.routines
    }
  }

  return (
    <Card className="mb-6">
      <CardBody className="p-3">
        <div className="grid grid-cols-7 gap-1">
          {WEEK_DAYS.map(({ label, weekday }) => {
            const routines = dayMap[weekday] ?? []
            return (
              <div key={weekday} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                  {label}
                </span>
                <div className="w-full min-h-[56px] rounded-lg bg-zinc-50 p-1 space-y-1">
                  {routines.length === 0 ? (
                    <div className="flex h-full min-h-[40px] items-center justify-center">
                      <span className="text-[10px] text-zinc-300">—</span>
                    </div>
                  ) : (
                    routines.map((r) => (
                      <div
                        key={r.id}
                        className={cn('rounded px-1 py-0.5 text-center text-[11px] font-medium leading-snug', colorClasses(r.color).soft)}
                        title={r.name}
                      >
                        {r.emoji && <span>{r.emoji} </span>}
                        <span className="truncate">{r.name}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardBody>
    </Card>
  )
}
