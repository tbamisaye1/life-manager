import { useState } from 'react'
import { Modal, Button } from '../ui'
import { cn } from '../../lib/cn'

/** Google Calendar-style scope picker for editing/deleting a repeating event. */
export function RecurringScopeModal({ open, title, action = 'save', onChoose, onClose, pending = false, error = null }) {
  const [selected, setSelected] = useState('one')
  const verb = action === 'delete' ? 'Delete' : 'Save'
  const confirmLabel = action === 'delete' ? 'Delete' : 'Save'

  const options = [
    { scope: 'one', label: 'This event only', hint: 'Just this date — e.g. make only today a flagship event.' },
    { scope: 'following', label: 'This and following events', hint: 'This date onward. Time/title changes stay in Life Manager for Google events.' },
    { scope: 'all', label: 'All events', hint: 'Every occurrence in the series.' },
  ]

  return (
    <Modal
      open={open}
      onClose={pending ? undefined : onClose}
      title={title || 'Repeating event'}
      overlayClassName="z-[60]"
      footer={
        <>
          <Button onClick={onClose} disabled={pending}>Cancel</Button>
          <Button
            variant={action === 'delete' ? 'danger' : 'primary'}
            onClick={() => onChoose(selected)}
            disabled={pending}
          >
            {pending ? `${confirmLabel}…` : confirmLabel}
          </Button>
        </>
      }
    >
      <p className="mb-4 text-sm text-zinc-600">{verb} changes to which events?</p>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.scope}
            type="button"
            onClick={() => setSelected(o.scope)}
            disabled={pending}
            aria-pressed={selected === o.scope}
            className={cn(
              'w-full rounded-xl border px-4 py-3 text-left transition-colors',
              selected === o.scope
                ? 'border-indigo-500 bg-indigo-50/60'
                : 'border-zinc-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/40',
              pending && 'opacity-60',
            )}
          >
            <div className="text-sm font-semibold text-zinc-900">{o.label}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{o.hint}</div>
          </button>
        ))}
      </div>
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </Modal>
  )
}
