import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import {
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  format,
  isToday,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addHours,
  startOfHour,
} from 'date-fns'
import { NavPageHeader, Loading, ErrorState } from '../components/ui'
import { ScheduleToolbar } from '../components/schedule/ScheduleToolbar'
import { DayTimeline } from '../components/schedule/DayTimeline'
import { WeekTimeline } from '../components/schedule/WeekTimeline'
import { EventModal } from '../components/calendar/EventModal'
import { EventChip } from '../components/calendar/EventChip'
import { events as eventsResource } from '../hooks/resources'
import { useGoogleAccounts, useGoogleCalendarActions, useGoogleAutoSync, useMicrosoftAccounts, useMicrosoftCalendarActions, useMicrosoftAutoSync } from '../hooks/useIntegrations'
import { toISOLocal } from '../components/schedule/timeline'
import { cn } from '../lib/cn'

/** Short friendly label for an account from its email domain (yahoo.com → Yahoo). */
function accountShortLabel(email) {
  const d = (email.split('@')[1] || '').split('.')[0]
  return d ? d.charAt(0).toUpperCase() + d.slice(1) : email
}

/** Format a Date to "yyyy-MM-dd" for the API query. */
function toDateParam(date) {
  return format(date, 'yyyy-MM-dd')
}

/** Return today's date at midnight, no time component. */
function today() {
  const n = new Date()
  return new Date(n.getFullYear(), n.getMonth(), n.getDate())
}

/** Partition events into all-day and timed. */
function partitionEvents(events) {
  const allDay = []
  const timed = []
  for (const ev of events) {
    if (ev.all_day) allDay.push(ev)
    else timed.push(ev)
  }
  return { allDay, timed }
}

export default function DailySchedulePage() {
  // 'day' | 'week'
  const [view, setView] = useState('day')

  // In day-mode: the viewed day. In week-mode: any day within the week (we use Mon as anchor).
  const [anchorDate, setAnchorDate] = useState(today)

  // Modal state: null = closed
  const [modal, setModal] = useState(null)

  // Per-account view filter ('all' or an account email)
  const [accountFilter, setAccountFilter] = useState('all')
  const { data: gAccounts = [] } = useGoogleAccounts()
  const { data: mAccounts = [] } = useMicrosoftAccounts()
  const { sync: syncGoogle } = useGoogleCalendarActions()
  const { sync: syncMicrosoft } = useMicrosoftCalendarActions()
  useGoogleAutoSync(gAccounts.length > 0, syncGoogle)
  useMicrosoftAutoSync(mAccounts.length > 0, syncMicrosoft)
  const calendarAccounts = [
    ...gAccounts.map((a) => ({ email: a.email, label: accountShortLabel(a.email) })),
    ...mAccounts.map((a) => ({ email: a.email, label: accountShortLabel(a.email) })),
  ]
  const hasRemoteCalendars = calendarAccounts.length > 0
  const syncAll = () => {
    if (gAccounts.length) syncGoogle.mutate()
    if (mAccounts.length) syncMicrosoft.mutate()
  }

  // --- Date range for API query ---
  const weekStart = startOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekEnd = endOfWeek(anchorDate, { weekStartsOn: 1 })
  const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd })

  const fromParam = view === 'day' ? toDateParam(anchorDate) : toDateParam(weekStart)
  const toParam = view === 'day' ? toDateParam(anchorDate) : toDateParam(weekEnd)

  const { data: eventsData = [], isLoading, isError, refetch } = eventsResource.useList({
    from: fromParam,
    to: toParam,
  })

  const filteredEvents = accountFilter === 'all'
    ? eventsData
    : eventsData.filter((e) => e.google_account === accountFilter || e.microsoft_account === accountFilter)
  const { allDay, timed } = partitionEvents(filteredEvents)

  // --- Navigation ---
  const handlePrev = () => {
    if (view === 'day') setAnchorDate((d) => subDays(d, 1))
    else setAnchorDate((d) => subWeeks(d, 1))
  }
  const handleNext = () => {
    if (view === 'day') setAnchorDate((d) => addDays(d, 1))
    else setAnchorDate((d) => addWeeks(d, 1))
  }
  const handleToday = () => setAnchorDate(today())

  // --- Modal helpers ---
  /** Single-click create: open with just a start time. */
  const openCreate = (startDate, endDate) => {
    const prefillStart = toISOLocal(startDate)
    const prefillEnd = endDate ? toISOLocal(endDate) : undefined
    setModal({ event: null, prefillDate: startDate, prefillStart, prefillEnd })
  }

  /** "New event" button: default to next round hour on the current day. */
  const openNewEvent = () => {
    const base = view === 'day' ? anchorDate : today()
    const now = new Date()
    // If viewing today, default to the next hour from now; otherwise 9 AM.
    const isViewingToday = isToday(base)
    const defaultStart = isViewingToday
      ? startOfHour(addHours(now, 1))
      : new Date(base.getFullYear(), base.getMonth(), base.getDate(), 9, 0, 0)
    const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000) // +1 hour
    const prefillStart = toISOLocal(defaultStart)
    const prefillEnd = toISOLocal(defaultEnd)
    setModal({ event: null, prefillDate: defaultStart, prefillStart, prefillEnd })
  }

  const openEdit = (event) => setModal({ event, prefillDate: null, prefillStart: null, prefillEnd: null })
  const closeModal = () => setModal(null)

  const modalKey = modal?.event?.id ?? `${modal?.prefillStart ?? modal?.prefillDate?.toISOString() ?? 'new'}|${modal?.prefillEnd ?? ''}`

  const pageSubtitle = view === 'day'
    ? isToday(anchorDate) ? 'Block out your day.' : `Schedule for ${format(anchorDate, 'MMMM d, yyyy')}.`
    : `Week of ${format(weekStart, 'MMM d')}–${format(weekEnd, 'MMM d, yyyy')}.`

  return (
    <div>
      <NavPageHeader
        path="/schedule"
        subtitle={pageSubtitle}
        icon={CalendarClock}
      />

      <ScheduleToolbar
        view={view}
        onViewChange={setView}
        anchorDate={anchorDate}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
        onNewEvent={openNewEvent}
        onSync={hasRemoteCalendars ? syncAll : undefined}
        syncing={syncGoogle.isPending || syncMicrosoft.isPending}
      />

      {/* Per-account filter — default shows all calendars */}
      {hasRemoteCalendars && (
        <div className="mb-3 flex flex-wrap gap-1.5">
          {[{ email: 'all', label: 'All calendars' }, ...calendarAccounts].map((f) => (
            <button
              key={f.email}
              onClick={() => setAccountFilter(f.email)}
              className={cn(
                'rounded-full border px-3 py-1 text-sm font-medium transition-colors',
                accountFilter === f.email
                  ? 'border-indigo-600 bg-indigo-600 text-white'
                  : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <Loading label="Loading schedule…" />
      ) : isError ? (
        <ErrorState message="Couldn't load events" onRetry={refetch} />
      ) : (
        <>
          {/* All-day strip — day-mode only (week view has no all-day row for now) */}
          {view === 'day' && allDay.length > 0 && (
            <div
              className={cn(
                'mb-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-zinc-200',
                'bg-white px-3 py-2 shadow-sm',
              )}
            >
              <span className="mr-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
                All day
              </span>
              {allDay.map((ev) => (
                <div key={ev.id} className="w-40 max-w-xs">
                  <EventChip event={ev} onClick={openEdit} />
                </div>
              ))}
            </div>
          )}

          {/* Empty hint */}
          {timed.length === 0 && allDay.length === 0 && (
            <p className="mb-2 text-sm text-zinc-500">
              Nothing scheduled yet — click any time slot to add a block, or drag to set a range.
            </p>
          )}

          {view === 'day' ? (
            <DayTimeline
              day={anchorDate}
              events={timed}
              onOpen={openEdit}
              onCreateAt={openCreate}
            />
          ) : (
            <WeekTimeline
              weekDays={weekDays}
              events={timed}
              onOpen={openEdit}
              onCreateAt={openCreate}
            />
          )}
        </>
      )}

      {modal && (
        <EventModal
          key={modalKey}
          event={modal.event}
          prefillDate={modal.prefillDate}
          prefillStart={modal.prefillStart}
          prefillEnd={modal.prefillEnd}
          defaultFlagship={false}
          open
          onClose={closeModal}
        />
      )}
    </div>
  )
}
