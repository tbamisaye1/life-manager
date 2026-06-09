import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { Modal, Button, Input, Textarea, Select, Label, Checkbox } from '../ui'
import { events as eventsResource, projects as projectsResource } from '../../hooks/resources'
import { PROJECT_COLORS, colorClasses } from '../../lib/colors'
import { cn } from '../../lib/cn'

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
 * Props: event (null = create), prefillDate (Date|null), prefillStart (ISO string with time, e.g. "2026-06-09T14:00"), open, onClose
 */
export function EventModal({ event, prefillDate, prefillStart, open, onClose }) {
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
      }
    : {
        title: '',
        start: hasPrefillTime ? prefillStart.slice(0, 16) : (prefillDate ? dateToDate(prefillDate) : ''),
        end: hasPrefillTime ? prefillStart.slice(0, 16) : (prefillDate ? dateToDate(prefillDate) : ''),
        all_day: hasPrefillTime ? false : true,
        location: '',
        notes: '',
        color: DEFAULT_COLOR,
        project_id: '',
      }

  const [draft, setDraft] = useState(initialDraft)
  const { data: projectList = [] } = projectsResource.useList()
  const create = eventsResource.useCreate()
  const update = eventsResource.useUpdate()
  const remove = eventsResource.useRemove()

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }))

  const handleAllDayToggle = (checked) => {
    set({
      all_day: checked,
      start: draft.start ? draft.start.slice(0, 10) : draft.start,
      end: draft.end ? draft.end.slice(0, 10) : draft.end,
    })
  }

  const save = async () => {
    const payload = {
      title: draft.title,
      start: draft.start,
      end: draft.end || draft.start,
      all_day: draft.all_day ? 1 : 0,
      location: draft.location || null,
      notes: draft.notes || null,
      color: draft.color || DEFAULT_COLOR,
      project_id: draft.project_id || null,
    }
    if (isEditing) {
      await update.mutateAsync({ id: event.id, ...payload })
    } else {
      await create.mutateAsync(payload)
    }
    onClose()
  }

  const del = async () => {
    await remove.mutateAsync(event.id)
    onClose()
  }

  const isPending = create.isPending || update.isPending || remove.isPending

  return (
    <Modal
      open={open}
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
            disabled={isPending || !draft.title.trim()}
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

        {/* All-day toggle */}
        <div className="flex items-center gap-2">
          <Checkbox
            checked={draft.all_day}
            onChange={(checked) => handleAllDayToggle(checked)}
            label="All-day event"
          />
          <span className="text-sm text-zinc-600">All-day</span>
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
  )
}
