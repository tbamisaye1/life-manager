import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Modal, Button, Input, Textarea, Select, Label, Checkbox } from '../ui'
import { events as eventsResource, projects as projectsResource } from '../../hooks/resources'
import { useGoogleCalendars, useGoogleAccounts, useMicrosoftCalendars, useMicrosoftAccounts } from '../../hooks/useIntegrations'
import { api } from '../../lib/api'
import { PROJECT_COLORS, colorClasses } from '../../lib/colors'
import { cn } from '../../lib/cn'
import { isRecurringEvent } from '../../lib/eventSeries'
import { RecurringScopeModal } from './RecurringScopeModal'

// Build "Add to" targets: local + each selected Google/Microsoft calendar.
function buildTargets(gCalendars, gAccounts, mCalendars, mAccounts) {
  const targets = [{ value: 'local', label: 'Life Manager', isLocal: true }]
  for (const c of (gCalendars || []).filter((c) => c.selected)) {
    targets.push({
      value: `google::${c.id}`,
      label: `${c.summary} · ${c.account_email}`,
      email: c.account_email,
      calendarId: c.calendar_id,
      provider: 'google',
      isLocal: false,
    })
  }
  for (const c of (mCalendars || []).filter((c) => c.selected)) {
    targets.push({
      value: `microsoft::${c.id}`,
      label: `${c.summary} · ${c.account_email}`,
      email: c.account_email,
      calendarId: c.calendar_id,
      provider: 'microsoft',
      isLocal: false,
    })
  }
  let defaultTarget = 'local'
  const defG = (gAccounts || []).find((a) => a.is_default)
  if (defG) {
    const prim = (gCalendars || []).find((c) => c.selected && c.account_email === defG.email && c.is_primary)
      || (gCalendars || []).find((c) => c.selected && c.account_email === defG.email)
    if (prim) defaultTarget = `google::${prim.id}`
  } else {
    const defM = (mAccounts || []).find((a) => a.is_default)
    if (defM) {
      const prim = (mCalendars || []).find((c) => c.selected && c.account_email === defM.email && c.is_primary)
        || (mCalendars || []).find((c) => c.selected && c.account_email === defM.email)
      if (prim) defaultTarget = `microsoft::${prim.id}`
    }
  }
  return { targets, defaultTarget }
}

/** Convert ISO/date string to datetime-local or date input value. */
const toInputValue = (iso, allDay) => {
  if (!iso) return ''
  return allDay || iso.length <= 10 ? iso.slice(0, 10) : iso.slice(0, 16)
}

/** Convert a JS Date to a date string. */
const dateToDate = (date) => format(date, 'yyyy-MM-dd')

const DEFAULT_COLOR = 'blue'

/**
 * Create or edit an event. Parent passes `key={event?.id ?? 'new'}` for clean
 * remount per event. When `event` is null, `prefillDate` seeds the start field.
 * Props:
 *   event        – null = create mode
 *   prefillDate  – Date|null — seeds date when no time info
 *   prefillStart – ISO datetime string (e.g. "2026-06-09T14:00")
 *   prefillEnd   – ISO datetime string (optional); when provided with prefillStart,
 *                  seeds the end field and forces all_day=false (backward-compatible:
 *                  omitting it preserves prior behavior)
 *   open, onClose
 */
export function EventModal({ event, prefillDate, prefillStart, prefillEnd, open, onClose, defaultFlagship = true }) {
  const isEditing = !!event

  // prefillStart (ISO with time) takes priority over prefillDate for timed events
  const hasPrefillTime = !isEditing && !!prefillStart

  const initialDraft = isEditing
    ? {
        title: event.title || '',
        start: toInputValue(event.start, event.all_day),
        end: toInputValue(event.end, event.all_day),
        all_day: !!event.all_day,
        location: event.location || '',
        notes: event.notes || '',
        color: event.color || DEFAULT_COLOR,
        project_id: event.project_id || '',
        flagship: event.flagship !== false && event.flagship !== 0,
      }
    : {
        title: '',
        start: hasPrefillTime ? prefillStart.slice(0, 16) : (prefillDate ? dateToDate(prefillDate) : ''),
        // Use prefillEnd when provided (drag-to-create); otherwise fall back to same as start
        end: hasPrefillTime
          ? (prefillEnd ? prefillEnd.slice(0, 16) : prefillStart.slice(0, 16))
          : (prefillDate ? dateToDate(prefillDate) : ''),
        all_day: hasPrefillTime ? false : true,
        location: '',
        notes: '',
        color: DEFAULT_COLOR,
        project_id: '',
        flagship: defaultFlagship,
      }

  const { data: gCalendars = [] } = useGoogleCalendars()
  const { data: gAccounts = [] } = useGoogleAccounts()
  const { data: mCalendars = [] } = useMicrosoftCalendars()
  const { data: mAccounts = [] } = useMicrosoftAccounts()
  const { targets, defaultTarget } = buildTargets(gCalendars, gAccounts, mCalendars, mAccounts)

  const [draft, setDraft] = useState({
    ...initialDraft,
    target: isEditing
      ? (event.source === 'google' && event.google_account
        ? `google::${event.google_account}::${event.google_calendar_id}`
        : event.source === 'microsoft' && event.microsoft_account
          ? `microsoft::${event.microsoft_account}::${event.microsoft_calendar_id}`
          : 'local')
      : defaultTarget,
    repeat: 'none',
    weekdays: [],
  })
  const [scopeModal, setScopeModal] = useState(null) // { action: 'save'|'delete' }
  const [scopePending, setScopePending] = useState(false)
  const [scopeError, setScopeError] = useState(null)
  const { data: projectList = [] } = projectsResource.useList()
  const create = eventsResource.useCreate()
  const update = eventsResource.useUpdate()
  const remove = eventsResource.useRemove()
  const queryClient = useQueryClient()
  const createGoogle = useMutation({
    mutationFn: (body) => api.post('/integrations/google/events', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
  const createMicrosoft = useMutation({
    mutationFn: (body) => api.post('/integrations/microsoft/events', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })
  const createLocalRecurring = useMutation({
    mutationFn: (body) => api.post('/events/recurring', body),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['today'] })
    },
  })

  const REPEAT_OPTS = [
    { value: 'none', label: 'Does not repeat' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekdays', label: 'Weekdays (Mon–Fri)' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'custom', label: 'Custom days' },
  ]
  const WD = [{ v: 1, l: 'M' }, { v: 2, l: 'T' }, { v: 3, l: 'W' }, { v: 4, l: 'T' }, { v: 5, l: 'F' }, { v: 6, l: 'S' }, { v: 0, l: 'S' }]
  const isRepeating = !isEditing && draft.repeat !== 'none'

  // Map the repeat choice to recurrence fields for the API.
  const recurrenceFields = () => {
    const f = {}
    if (draft.repeat === 'daily') f.frequency = 'daily'
    else if (draft.repeat === 'weekdays') f.weekdays = [1, 2, 3, 4, 5]
    else if (draft.repeat === 'weekly') f.weekdays = [new Date(`${draft.start.slice(0, 10)}T00:00:00`).getDay()]
    else if (draft.repeat === 'custom') f.weekdays = draft.weekdays
    return f
  }

  const targetMeta = targets.find((t) => t.value === draft.target) || targets[0]
  const isRemoteTarget = !isEditing && targetMeta && !targetMeta.isLocal
  const isGoogleTarget = isRemoteTarget && targetMeta.provider === 'google'
  const isMicrosoftTarget = isRemoteTarget && targetMeta.provider === 'microsoft'

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const handleAllDayToggle = (checked) => {
    set({
      all_day: checked,
      start: draft.start ? draft.start.slice(0, 10) : draft.start,
      end: draft.end ? draft.end.slice(0, 10) : draft.end,
    })
  }

  const buildPayload = () => ({
    title: draft.title,
    start: draft.start,
    end: draft.end || draft.start,
    all_day: draft.all_day ? 1 : 0,
    location: draft.location || null,
    notes: draft.notes || null,
    color: draft.color || DEFAULT_COLOR,
    project_id: draft.project_id || null,
    flagship: draft.flagship ? 1 : 0,
  })

  const saveWithScope = async (scope) => {
    setScopePending(true)
    setScopeError(null)
    try {
      const payload = { ...buildPayload(), scope }
      if (isEditing) {
        await update.mutateAsync({ id: event.id, ...payload })
      } else if (isGoogleTarget) {
        await createGoogle.mutateAsync({ ...buildPayload(), email: targetMeta.email, calendar_id: targetMeta.calendarId, ...(isRepeating ? recurrenceFields() : {}) })
      } else if (isMicrosoftTarget) {
        await createMicrosoft.mutateAsync({ ...buildPayload(), email: targetMeta.email, calendar_id: targetMeta.calendarId, ...(isRepeating ? recurrenceFields() : {}) })
      } else if (isRepeating) {
        await createLocalRecurring.mutateAsync({
          title: payload.title, all_day: payload.all_day, location: payload.location, notes: payload.notes,
          color: payload.color, flagship: payload.flagship, start_date: draft.start.slice(0, 10),
          start_time: draft.all_day ? undefined : draft.start.slice(11, 16),
          end_time: draft.all_day ? undefined : (draft.end || draft.start).slice(11, 16),
          ...recurrenceFields(),
        })
      } else {
        await create.mutateAsync(buildPayload())
      }
      setScopeModal(null)
      onClose()
    } catch (err) {
      setScopeError(err.message || 'Could not save event')
    } finally {
      setScopePending(false)
    }
  }

  const save = () => {
    if (isEditing && isRecurringEvent(event)) {
      setScopeError(null)
      setScopeModal({ action: 'save' })
      return
    }
    saveWithScope('one')
  }

  const delWithScope = async (scope) => {
    setScopePending(true)
    setScopeError(null)
    try {
      await api.del(`/events/${event.id}?scope=${scope}`)
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['today'] })
      setScopeModal(null)
      onClose()
    } catch (err) {
      setScopeError(err.message || 'Could not delete event')
    } finally {
      setScopePending(false)
    }
  }

  const del = () => {
    if (isRecurringEvent(event)) {
      setScopeError(null)
      setScopeModal({ action: 'delete' })
      return
    }
    remove.mutateAsync(event.id).then(onClose)
  }

  const closeScopeModal = () => {
    if (scopePending) return
    setScopeModal(null)
    setScopeError(null)
  }

  const isPending = create.isPending || update.isPending || remove.isPending || createGoogle.isPending || createMicrosoft.isPending || createLocalRecurring.isPending
  const customInvalid = draft.repeat === 'custom' && draft.weekdays.length === 0

  return (
    <>
    <Modal
      open={open && !scopeModal}
      onClose={onClose}
      title={isEditing ? 'Edit Event' : 'New Event'}
      footer={
        <>
          {isEditing && (
            <Button variant="danger" onClick={del} className="mr-auto" disabled={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={save}
            disabled={isPending || !draft.title.trim() || customInvalid}
          >
            {isPending ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Title */}
        <div>
          <Label>Title</Label>
          <Input
            value={draft.title}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="Event name…"
            autoFocus
          />
        </div>

        {/* Add to — local or a Google calendar (create mode only) */}
        {!isEditing && targets.length > 1 && (
          <div>
            <Label>Add to</Label>
            <Select value={draft.target} onChange={(e) => set({ target: e.target.value })}>
              {targets.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </Select>
          </div>
        )}
        {isEditing && event.source === 'google' && (
          <p className="text-xs text-zinc-500">On Google Calendar · {event.google_account}</p>
        )}
        {isEditing && event.source === 'microsoft' && (
          <p className="text-xs text-zinc-500">On Outlook · {event.microsoft_account}</p>
        )}

        {/* Repeat (create mode) */}
        {!isEditing && (
          <div>
            <Label>Repeat</Label>
            <Select value={draft.repeat} onChange={(e) => set({ repeat: e.target.value })}>
              {REPEAT_OPTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
            {draft.repeat === 'custom' && (
              <div className="mt-2 flex gap-1.5">
                {WD.map((d) => {
                  const on = draft.weekdays.includes(d.v)
                  return (
                    <button
                      key={d.v}
                      type="button"
                      onClick={() => set({ weekdays: on ? draft.weekdays.filter((x) => x !== d.v) : [...draft.weekdays, d.v] })}
                      className={cn('h-8 w-8 rounded-full text-sm font-semibold', on ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-600')}
                    >
                      {d.l}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* All-day toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={draft.all_day}
            onChange={(checked) => handleAllDayToggle(checked)}
            label="All-day event"
          />
          <span className="text-sm text-zinc-600">All-day</span>
        </div>

        {/* Flagship toggle — month overview; not for remote calendar creates */}
        <div className={cn('flex items-center gap-2', isRemoteTarget && 'hidden')}>
          <Checkbox
            checked={draft.flagship}
            onChange={(checked) => set({ flagship: checked })}
            label="Show on month calendar"
          />
          <span className="text-sm text-zinc-600">Show on month calendar</span>
        </div>

        {/* Start / End */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Start</Label>
            <Input
              type={draft.all_day ? 'date' : 'datetime-local'}
              value={draft.start}
              onChange={(e) => set({ start: e.target.value })}
            />
          </div>
          <div>
            <Label>End</Label>
            <Input
              type={draft.all_day ? 'date' : 'datetime-local'}
              value={draft.end}
              onChange={(e) => set({ end: e.target.value })}
            />
          </div>
        </div>

        {/* Color + Project */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Color</Label>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {PROJECT_COLORS.map((c) => {
                const { dot } = colorClasses(c)
                return (
                  <button
                    key={c}
                    type="button"
                    aria-label={c}
                    onClick={() => set({ color: c })}
                    className={cn(
                      'h-5 w-5 rounded-full transition-transform hover:scale-110',
                      dot,
                      draft.color === c && 'ring-2 ring-offset-1 ring-zinc-400',
                    )}
                  />
                )
              })}
            </div>
          </div>
          <div>
            <Label>Project</Label>
            <Select
              value={draft.project_id}
              onChange={(e) => set({ project_id: e.target.value })}
            >
              <option value="">None</option>
              {projectList.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.short_code || p.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {/* Location */}
        <div>
          <Label>Location</Label>
          <Input
            value={draft.location}
            onChange={(e) => set({ location: e.target.value })}
            placeholder="Optional location…"
          />
        </div>

        {/* Notes */}
        <div>
          <Label>Notes</Label>
          <Textarea
            value={draft.notes}
            onChange={(e) => set({ notes: e.target.value })}
            placeholder="Add detail…"
          />
        </div>
      </div>
    </Modal>

    <RecurringScopeModal
      key={scopeModal?.action ?? 'scope'}
      open={!!scopeModal}
      title={scopeModal?.action === 'delete' ? `Delete “${event?.title}”` : `Save “${event?.title}”`}
      action={scopeModal?.action}
      pending={scopePending}
      error={scopeError}
      onClose={closeScopeModal}
      onChoose={(scope) => (scopeModal?.action === 'delete' ? delWithScope(scope) : saveWithScope(scope))}
    />
    </>
  )
}
