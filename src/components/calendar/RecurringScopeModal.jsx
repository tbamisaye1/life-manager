import { Modal, Button } from '../ui'

/** Google Calendar-style scope picker for editing/deleting a repeating event. */
export function RecurringScopeModal({ open, title, action = 'save', onChoose, onClose }) {
  const verb = action === 'delete' ? 'Delete' : 'Save'
  const options = [
    { scope: 'one', label: 'This event only', hint: 'Just this date — e.g. make only today a flagship event.' },
    { scope: 'following', label: 'This and following events', hint: 'This date onward. Time/title changes stay in Life Manager for Google events.' },
    { scope: 'all', label: 'All events', hint: 'Every occurrence in the series.' },
  ]

  return (
    <Modal open={open} onClose={onClose} title={title || 'Repeating event'} footer={<Button onClick={onClose}>Cancel</Button>}>
      <p className="mb-4 text-sm text-zinc-600">{verb} changes to which events?</p>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.scope}
            type="button"
            onClick={() => onChoose(o.scope)}
            className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-left hover:border-indigo-300 hover:bg-indigo-50/40"
          >
            <div className="text-sm font-semibold text-zinc-900">{o.label}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{o.hint}</div>
          </button>
        ))}
      </div>
    </Modal>
  )
}
