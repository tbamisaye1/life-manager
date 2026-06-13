import { useState } from 'react'
import { Calendar } from 'lucide-react'
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addMonths,
  format,
} from 'date-fns'
import { PageHeader, Loading, ErrorState } from '../components/ui'
import { CalendarHeader } from '../components/calendar/CalendarHeader'
import { MonthGrid } from '../components/calendar/MonthGrid'
import { EventModal } from '../components/calendar/EventModal'
import { events as eventsResource } from '../hooks/resources'
import { useGoogleAccounts, useGoogleCalendarActions, useGoogleAutoSync } from '../hooks/useIntegrations'

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })

  // Modal state: null = closed, { event, prefillDate }
  const [modal, setModal] = useState(null)

  const { data: gAccounts = [] } = useGoogleAccounts()
  const { sync } = useGoogleCalendarActions()
  useGoogleAutoSync(gAccounts.length > 0, sync)

  // Compute the visible range (full grid including days from adjacent months)
  const from = format(startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd')
  const to = format(endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 }), 'yyyy-MM-dd')

  // Only "flagship" events appear on the month overview — the Daily Schedule
  // shows everything, the calendar shows just the things worth surfacing.
  const { data: eventsData = [], isLoading, isError, refetch } = eventsResource.useList({ from, to, flagship: 1 })

  const openCreate = (date) => setModal({ event: null, prefillDate: date })
  const openEdit = (event) => setModal({ event, prefillDate: null })
  const closeModal = () => setModal(null)

  // Key resets the modal on each open so draft initializes cleanly
  const modalKey = modal?.event?.id ?? (modal?.prefillDate?.toISOString() ?? 'new')

  return (
    <div>
      <PageHeader
        title="Calendar"
        subtitle="Your events, at a glance."
        icon={Calendar}
      />

      <CalendarHeader
        currentMonth={currentMonth}
        onPrev={() => setCurrentMonth((m) => addMonths(m, -1))}
        onNext={() => setCurrentMonth((m) => addMonths(m, 1))}
        onToday={() => setCurrentMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}
        onSync={gAccounts.length > 0 ? () => sync.mutate() : undefined}
        syncing={sync.isPending}
      />

      {isLoading ? (
        <Loading label="Loading events…" />
      ) : isError ? (
        <ErrorState message="Couldn't load events" onRetry={refetch} />
      ) : (
        <MonthGrid
          currentMonth={currentMonth}
          events={eventsData}
          onAddEvent={openCreate}
          onOpenEvent={openEdit}
        />
      )}

      {modal && (
        <EventModal
          key={modalKey}
          event={modal.event}
          prefillDate={modal.prefillDate}
          open
          onClose={closeModal}
        />
      )}
    </div>
  )
}
