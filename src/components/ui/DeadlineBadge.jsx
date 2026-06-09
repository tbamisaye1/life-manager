import { AlertCircle, Hourglass, CheckCircle2, CalendarOff } from 'lucide-react'
import { cn } from '../../lib/cn'
import { deadlineStatus } from '../../lib/format'

// Maps deadline tone -> styling + icon. This is the badge from the user's
// Notion screenshot ("Overdue by N days" / "Due in N days").
const TONE_STYLES = {
  overdue: { cls: 'bg-red-50 text-red-600', Icon: AlertCircle },
  urgent: { cls: 'bg-orange-50 text-orange-600', Icon: Hourglass },
  soon: { cls: 'bg-amber-50 text-amber-700', Icon: Hourglass },
  upcoming: { cls: 'bg-zinc-100 text-zinc-500', Icon: Hourglass },
  done: { cls: 'bg-emerald-50 text-emerald-600', Icon: CheckCircle2 },
  none: { cls: 'bg-zinc-50 text-zinc-400', Icon: CalendarOff },
}

export function DeadlineBadge({ date, done = false, className }) {
  const { tone, label } = deadlineStatus(date, { done })
  const { cls, Icon } = TONE_STYLES[tone] || TONE_STYLES.none
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium whitespace-nowrap', cls, className)}>
      <Icon className="h-3.5 w-3.5" />
      {label}
    </span>
  )
}
