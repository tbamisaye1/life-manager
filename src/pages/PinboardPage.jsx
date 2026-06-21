import { useMemo, useRef, useState } from 'react'
import { Pin } from 'lucide-react'
import { Loading, ErrorState, EmptyState, NavPageHeader } from '../components/ui'
import { PinCaptureBar } from '../components/pins/PinCaptureBar'
import { PinboardGrid } from '../components/pins/PinboardGrid'
import { PinEditModal } from '../components/pins/PinEditModal'
import { pins as pinsResource } from '../hooks/resources'
import { organizePins, PIN_COLORS } from '../lib/pinUtils'

export default function PinboardPage() {
  const { data: list = [], isLoading, isError, refetch } = pinsResource.useList()
  const create = pinsResource.useCreate()
  const update = pinsResource.useUpdate()
  const remove = pinsResource.useRemove()

  const [text, setText] = useState('')
  const [editing, setEditing] = useState(null)
  const colorCursor = useRef(0)

  const { pinned, buckets } = useMemo(() => organizePins(list), [list])
  const total = list.length

  if (isLoading) return <Loading label="Loading pins…" />
  if (isError) return <ErrorState message="Couldn't load your pinboard" onRetry={refetch} />

  const handleAdd = () => {
    const body = text.trim()
    if (!body) return
    const color = PIN_COLORS[colorCursor.current % PIN_COLORS.length]
    colorCursor.current += 1
    create.mutate({ body, color })
    setText('')
  }

  const handleTogglePin = (pin) => update.mutate({ id: pin.id, pinned: !pin.pinned })

  const handleSaveEdit = (patch) => {
    update.mutate({ id: editing.id, ...patch }, { onSuccess: () => setEditing(null) })
  }

  const handleDelete = (pin) => remove.mutate(pin.id)

  return (
    <div className="mx-auto max-w-6xl">
      <NavPageHeader
        path="/pins"
        icon={Pin}
        subtitle={
          total
            ? `${total} idea${total === 1 ? '' : 's'}${pinned.length ? ` · ${pinned.length} pinned` : ''} — scan the board at a glance`
            : 'Quick-capture thoughts you want to revisit — no folders, no friction'
        }
      />

      <PinCaptureBar
        value={text}
        onChange={setText}
        onSubmit={handleAdd}
        pending={create.isPending}
      />

      {total === 0 ? (
        <EmptyState
          icon={Pin}
          title="Nothing pinned yet"
          description="Drop a quick thought above — it'll land on the board as a colour-coded sticky note you can scan in one glance."
        />
      ) : (
        <div className="rounded-2xl bg-[linear-gradient(180deg,#faf8f5_0%,#f4f4f5_100%)] p-3 ring-1 ring-black/[0.04] sm:p-4">
          <PinboardGrid
            pinned={pinned}
            buckets={buckets}
            onEdit={setEditing}
            onTogglePin={handleTogglePin}
            onDelete={handleDelete}
          />
        </div>
      )}

      <PinEditModal
        key={editing?.id ?? 'closed'}
        pin={editing}
        open={!!editing}
        onClose={() => setEditing(null)}
        onSave={handleSaveEdit}
        onDelete={() => { handleDelete(editing); setEditing(null) }}
        saving={update.isPending}
      />
    </div>
  )
}
