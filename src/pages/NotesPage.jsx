import { useState } from 'react'
import { StickyNote, Plus } from 'lucide-react'
import { PageHeader, Button, Loading, ErrorState, EmptyState } from '../components/ui'
import { NoteCard } from '../components/notes/NoteCard'
import { NoteEditorModal } from '../components/notes/NoteEditorModal'
import { notes as notesResource } from '../hooks/resources'

export default function NotesPage() {
  const { data: notes = [], isLoading, isError, refetch } = notesResource.useList()
  const update = notesResource.useUpdate()
  const [editing, setEditing] = useState(undefined) // undefined = closed, null = new, obj = edit

  if (isLoading) return <Loading label="Loading notes…" />
  if (isError) return <ErrorState message="Couldn't load notes" onRetry={refetch} />

  const togglePin = (note) => update.mutate({ id: note.id, pinned: !note.pinned })

  return (
    <div>
      <PageHeader
        title="Notes & Ideas"
        subtitle="Jot anything down and come back to it later."
        icon={StickyNote}
        actions={<Button variant="primary" onClick={() => setEditing(null)}><Plus className="h-4 w-4" /> New note</Button>}
      />

      {notes.length === 0 ? (
        <EmptyState icon={StickyNote} title="No notes yet" description="Capture a thought, an idea, or a reminder."
          action={<Button variant="primary" onClick={() => setEditing(null)}>New note</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard key={note.id} note={note} onOpen={setEditing} onTogglePin={togglePin} />
          ))}
        </div>
      )}

      <NoteEditorModal
        key={editing === undefined ? 'closed' : editing?.id || 'new'}
        note={editing}
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
      />
    </div>
  )
}
