import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Input, Select, Label } from '../ui'
import { RichEditor } from '../editor/RichEditor'
import { priorities as prioritiesResource } from '../../hooks/resources'

/**
 * Expandable detail for a priority — headline + cadence + a rich notes body.
 * Parent passes key={priority?.id} so it re-seeds per item.
 */
export function PriorityDetailModal({ priority, open, onClose }) {
  const update = prioritiesResource.useUpdate()
  const remove = prioritiesResource.useRemove()
  const [title, setTitle] = useState(priority?.title || '')
  const [cadence, setCadence] = useState(priority?.cadence || 'daily')
  const body = useRef(priority?.body || '')

  if (!priority) return null

  const save = async () => {
    await update.mutateAsync({ id: priority.id, title, cadence, body: body.current })
    onClose()
  }
  const del = async () => { await remove.mutateAsync(priority.id); onClose() }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Priority"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="danger" onClick={del} className="mr-auto"><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={update.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="flex-1">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="w-32">
            <Label>Repeats</Label>
            <Select value={cadence} onChange={(e) => setCadence(e.target.value)}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </Select>
          </div>
        </div>
        <div>
          <Label>Notes &amp; detail</Label>
          <div className="rounded-lg border border-zinc-200 px-3 py-2">
            <RichEditor value={priority.body} onChange={(v) => { body.current = v }} placeholder="Why it matters, sub-steps, what 'done' looks like…" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
