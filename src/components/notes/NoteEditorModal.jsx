import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Input, Textarea } from '../ui'
import { notes as notesResource } from '../../hooks/resources'

/**
 * Create or edit a note. The parent passes a `key` tied to the note id so this
 * remounts (and re-seeds its fields) whenever a different note is opened.
 */
export function NoteEditorModal({ note, open, onClose }) {
  const [title, setTitle] = useState(note?.title || '')
  const [body, setBody] = useState(note?.body || '')
  const create = notesResource.useCreate()
  const update = notesResource.useUpdate()
  const remove = notesResource.useRemove()

  const save = async () => {
    if (note?.id) await update.mutateAsync({ id: note.id, title, body })
    else await create.mutateAsync({ title, body })
    onClose()
  }
  const del = async () => { if (note?.id) await remove.mutateAsync(note.id); onClose() }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={note?.id ? 'Edit note' : 'New note'}
      footer={
        <>
          {note?.id && (
            <Button variant="danger" onClick={del} className="mr-auto">
              <Trash2 className="h-4 w-4" /> Delete
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={create.isPending || update.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Jot it down…" className="min-h-[160px]" />
      </div>
    </Modal>
  )
}
