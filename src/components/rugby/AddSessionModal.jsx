import { useState } from 'react'
import { Modal, Button, Input, Textarea, Select, Label } from '../ui'
import { useCreateSession } from '../../hooks/useRugby'

const EMPTY = {
  date: '',
  type: 'training',
  opponent: '',
  position: '',
  rating: '',
  tackles: '',
  turnovers: '',
  meters: '',
  tries: '',
  minutes: '',
  sprints: '',
  notes: '',
}

/** Modal for logging a new session. Parent should remount via key= to reset state. */
export function AddSessionModal({ open, onClose }) {
  const createSession = useCreateSession()
  const [form, setForm] = useState(EMPTY)

  const isGame = form.type === 'game'

  const set = (field) => (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))

  const buildMetrics = () => {
    const num = (v) => (v !== '' ? Number(v) : undefined)
    const m = {}
    if (isGame) {
      if (form.tackles !== '') m.tackles = num(form.tackles)
      if (form.turnovers !== '') m.turnovers = num(form.turnovers)
      if (form.meters !== '') m.meters = num(form.meters)
      if (form.tries !== '') m.tries = num(form.tries)
    } else {
      if (form.minutes !== '') m.minutes = num(form.minutes)
      if (form.sprints !== '') m.sprints = num(form.sprints)
    }
    return Object.keys(m).length > 0 ? m : undefined
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.date || !form.type) return
    const payload = {
      date: form.date,
      type: form.type,
      opponent: isGame && form.opponent.trim() ? form.opponent.trim() : undefined,
      position: isGame && form.position.trim() ? form.position.trim() : undefined,
      rating: form.rating !== '' ? Number(form.rating) : undefined,
      metrics: buildMetrics(),
      notes: form.notes.trim() || undefined,
    }
    createSession.mutate(payload, { onSuccess: onClose })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log session"
      footer={
        <>
          <Button type="button" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            type="submit"
            form="add-session-form"
            disabled={!form.date || createSession.isPending}
          >
            Save session
          </Button>
        </>
      }
    >
      <form id="add-session-form" onSubmit={handleSubmit} className="space-y-4">
        {/* Date + Type */}
        <div className="flex gap-3">
          <div className="flex-1">
            <Label htmlFor="s-date">Date</Label>
            <Input id="s-date" type="date" value={form.date} onChange={set('date')} required />
          </div>
          <div className="w-36">
            <Label htmlFor="s-type">Type</Label>
            <Select id="s-type" value={form.type} onChange={set('type')}>
              <option value="training">Training</option>
              <option value="game">Game</option>
            </Select>
          </div>
        </div>

        {/* Game-specific fields */}
        {isGame && (
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="s-opponent">Opponent</Label>
              <Input
                id="s-opponent"
                value={form.opponent}
                onChange={set('opponent')}
                placeholder="e.g. City RFC"
              />
            </div>
            <div className="flex-1">
              <Label htmlFor="s-position">Position</Label>
              <Input
                id="s-position"
                value={form.position}
                onChange={set('position')}
                placeholder="e.g. Flanker"
              />
            </div>
          </div>
        )}

        {/* Rating */}
        <div className="w-32">
          <Label htmlFor="s-rating">Self-rating (1–10)</Label>
          <Input
            id="s-rating"
            type="number"
            min="1"
            max="10"
            value={form.rating}
            onChange={set('rating')}
            placeholder="—"
          />
        </div>

        {/* Metrics — game */}
        {isGame && (
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500">Metrics (leave blank to omit)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="s-tackles">Tackles</Label>
                <Input id="s-tackles" type="number" min="0" value={form.tackles} onChange={set('tackles')} placeholder="—" />
              </div>
              <div>
                <Label htmlFor="s-turnovers">Turnovers</Label>
                <Input id="s-turnovers" type="number" min="0" value={form.turnovers} onChange={set('turnovers')} placeholder="—" />
              </div>
              <div>
                <Label htmlFor="s-meters">Meters gained</Label>
                <Input id="s-meters" type="number" min="0" value={form.meters} onChange={set('meters')} placeholder="—" />
              </div>
              <div>
                <Label htmlFor="s-tries">Tries</Label>
                <Input id="s-tries" type="number" min="0" value={form.tries} onChange={set('tries')} placeholder="—" />
              </div>
            </div>
          </div>
        )}

        {/* Metrics — training */}
        {!isGame && (
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-500">Metrics (leave blank to omit)</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="s-minutes">Minutes</Label>
                <Input id="s-minutes" type="number" min="0" value={form.minutes} onChange={set('minutes')} placeholder="—" />
              </div>
              <div>
                <Label htmlFor="s-sprints">Sprints</Label>
                <Input id="s-sprints" type="number" min="0" value={form.sprints} onChange={set('sprints')} placeholder="—" />
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <Label htmlFor="s-notes">Notes</Label>
          <Textarea
            id="s-notes"
            value={form.notes}
            onChange={set('notes')}
            placeholder="How did it go?"
          />
        </div>
      </form>
    </Modal>
  )
}
