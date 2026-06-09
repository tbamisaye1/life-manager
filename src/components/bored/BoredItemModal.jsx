import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Input, Select, Label } from '../ui'
import { RichEditor } from '../editor/RichEditor'
import { boredItems as boredResource } from '../../hooks/resources'
import { BORED_CATEGORIES } from './categories'

/**
 * Edit a Bored-list item (title, icon, category, rich detail body). New items
 * are created title-only via the inline quick-add on the page, then opened here
 * to add detail. Parent passes key={item?.id} so it re-seeds per item.
 */
export function BoredItemModal({ item, open, onClose }) {
  const update = boredResource.useUpdate()
  const remove = boredResource.useRemove()
  const [title, setTitle] = useState(item?.title || '')
  const [emoji, setEmoji] = useState(item?.emoji || '💡')
  const [category, setCategory] = useState(item?.category || 'other')
  const body = useRef(item?.body || '')

  if (!item) return null

  const save = async () => {
    if (!title.trim()) return
    await update.mutateAsync({ id: item.id, title, emoji, category, body: body.current })
    onClose()
  }
  const del = async () => {
    if (!window.confirm(`Delete “${item.title}”?`)) return
    await remove.mutateAsync(item.id)
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit item"
      className="max-w-2xl"
      footer={
        <>
          <Button variant="danger" onClick={del} className="mr-auto"><Trash2 className="h-4 w-4" /> Delete</Button>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!title.trim() || update.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="w-16">
            <Label>Icon</Label>
            <Input value={emoji} onChange={(e) => setEmoji(e.target.value)} className="text-center" maxLength={2} />
          </div>
          <div className="flex-1">
            <Label>Title</Label>
            <Input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Learn chess openings" />
          </div>
          <div className="w-36">
            <Label>Category</Label>
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              {BORED_CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <Label>Notes &amp; detail</Label>
          <div className="rounded-lg border border-zinc-200 px-3 py-2">
            <RichEditor value={item.body} onChange={(v) => { body.current = v }} placeholder="Why you want to do this, links, sub-steps…" />
          </div>
        </div>
      </div>
    </Modal>
  )
}
