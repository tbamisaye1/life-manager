import { useRef, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Modal, Button, Input, Select, Label } from '../ui'
import { RichEditor } from '../editor/RichEditor'
import { boredItems as boredResource } from '../../hooks/resources'
import { BORED_CATEGORIES } from './categories'

/**
 * Create or edit a Bored-list item. Pass item=null to create.
 * Parent passes a `key` tied to the item id so it re-seeds per item.
 */
export function BoredItemModal({ item, open, onClose }) {
  const create = boredResource.useCreate()
  const update = boredResource.useUpdate()
  const remove = boredResource.useRemove()
  const [title, setTitle] = useState(item?.title || '')
  const [emoji, setEmoji] = useState(item?.emoji || '💡')
  const [category, setCategory] = useState(item?.category || 'other')
  const body = useRef(item?.body || '')

  const save = async () => {
    if (!title.trim()) return
    if (item?.id) await update.mutateAsync({ id: item.id, title, emoji, category, body: body.current })
    else await create.mutateAsync({ title, emoji, category })
    onClose()
  }
  const del = async () => { if (item?.id) await remove.mutateAsync(item.id); onClose() }
  const pending = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={item?.id ? 'Edit item' : 'New bored-list item'}
      className="max-w-2xl"
      footer={
        <>
          {item?.id && <Button variant="danger" onClick={del} className="mr-auto"><Trash2 className="h-4 w-4" /> Delete</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!title.trim() || pending}>Save</Button>
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
        {item?.id && (
          <div>
            <Label>Notes &amp; detail</Label>
            <div className="rounded-lg border border-zinc-200 px-3 pb-2">
              <RichEditor value={item.body} onChange={(v) => { body.current = v }} placeholder="Why you want to do this, links, sub-steps…" />
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
