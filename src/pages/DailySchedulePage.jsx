import { useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { addDays, subDays, format, isToday } from 'date-fns'
import { PageHeader, Loading, ErrorState } from '../components/ui'
import { ScheduleHeader } from '../components/schedule/ScheduleHeader'
import { DayTimeline } from '../components/schedule/DayTimeline'
import { EventModal } from '../components/calendar/EventModal'
import { EventChip } from '../components/calendar/EventChip'
import { events as eventsResource } from '../hooks/resources'
import { cn } from '../lib/cn'

/** Format a Date to "yyyy-MM-dd" for the API query. */
function toDateParam(date) {
  return format(date, 'yyyy-MM-dd')
}

/** Partition events into all-day and timed. */
function partitionEvents(events) {
  const allDay = []
  const timed = []
  for (const ev of events) {
    if (ev.all_day) {
      allDay.push(ev)
    } else {
      timed.push(ev)
    }
  }
  return { allDay, timed }
}

export default function DailySchedulePage() {
  const [currentDay, setCurrentDay] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })

  // Modal state: null = closed, { event, prefillDate, prefillStart }
  const [modal, setModal] = useState(null)

  const dateParam = toDateParam(currentDay)
  const { data: eventsData = [], isLoading, isError, refetch } = eventsResource.useList({
    from: dateParam,
    to: dateParam,
  })

  const { allDay, timed } = partitionEvents(eventsData)

  const openCreate = (date) => {
    // date is a JS Date with the clicked time
    const prefillStart = format(date, "yyyy-MM-dd'T'HH:mm")
    setModal({ event: null, prefillDate: date, prefillStart })
  }

  const openEdit = (event) => setModal({ event, prefillDate: null, prefillStart: null })
  const closeModal = () => setModal(null)

  // Key resets the modal on each open for a clean draft
  const modalKey = modal?.event?.id ?? (modal?.prefillStart ?? modal?.prefillDate?.toISOString() ?? 'new')

  const subtitle = isToday(currentDay)
    ? 'Block out your day.'
    : `Schedule for ${format(currentDay, 'MMMM d, yyyy')}.`

  return (
    <div>
      <PageHeader
        title="Daily Schedule"
        subtitle={subtitle}
        icon={CalendarClock}
      />

      <ScheduleHeader
        currentDay={currentDay}
        onPrev={() => setCurrentDay((d) => subDays(d, 1))}
        onNext={() => setCurrentDay((d) => addDays(d, 1))}
        onToday={() => {
          const now = new Date()
          setCurrentDay(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
        }}
      />

      {isLoading ? (
        <Loading label="Loading schedule…" />
      ) : isError ? (
        <ErrorState message="Couldn't load events" onRetry={refetch} />
      ) : (
        <>
          {/* All-day strip */}
          {allDay.length > 0 && (
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

          {/* Timed grid — always shown so you can click any slot to add a block. */}
          {timed.length === 0 && allDay.length === 0 && (
            <p className="mb-2 text-sm text-zinc-500">Nothing scheduled yet — click any time slot to add a block.</p>
          )}
          <DayTimeline
            day={currentDay}
            events={timed}
            onOpen={openEdit}
            onCreateAt={openCreate}
          />
        </>
      )}

      {modal && (
        <EventModal
          key={modalKey}
          event={modal.event}
          prefillDate={modal.prefillDate}
          prefillStart={modal.prefillStart}
          open
          onClose={closeModal}
        />
      )}
    </div>
  )
}
