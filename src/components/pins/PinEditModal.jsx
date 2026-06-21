import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Textarea, Label } from '../ui'
import { PIN_COLORS } from '../../lib/pinUtils'
import { colorClasses } from '../../lib/colors'
import { cn } from '../../lib/cn'

export function PinEditModal({ pin, open, onClose, onSave, onDelete, saving }) {
  const [body, setBody] = useState(pin?.body ?? '')
  const [color, setColor] = useState(pin?.color ?? 'amber')

  if (!pin) return null

  const save = () => {
    const trimmed = body.trim()
    if (!trimmed) return
    onSave({ body: trimmed, color })
  }

  const del = () => {
    if (!window.confirm('Delete this pin?')) return
    onDelete()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit pin"
      footer={
        <>
          <Button variant="danger" onClick={del} className="mr-auto">
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!body.trim() || saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Note</Label>
          <Textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={5}
            placeholder="Your thought…"
          />
        </div>
        <div>
          <Label>Colour</Label>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {PIN_COLORS.map((c) => {
              const { soft, dot } = colorClasses(c)
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium capitalize transition',
                    color === c ? 'border-zinc-400 ring-2 ring-indigo-200' : 'border-transparent',
                    soft,
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full', dot)} />
                  {c}
                </button>
              )
            })}
          </div>
        </div>
      </div>
    </Modal>
  )
}
