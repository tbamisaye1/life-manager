import { useState } from 'react'
import { Modal, Button, Input, Textarea, Label } from '../ui'
import { improvements as improvementsResource } from '../../hooks/resources'

/** Edit an improvement's metadata. Parent passes key={im.id} to re-seed. */
export function ImprovementEditModal({ improvement, open, onClose }) {
  const update = improvementsResource.useUpdate()
  const [form, setForm] = useState({
    emoji: improvement?.emoji || '🎯',
    title: improvement?.title || '',
    category: improvement?.category || '',
    summary: improvement?.summary || '',
    why: improvement?.why || '',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.title.trim()) return
    await update.mutateAsync({ id: improvement.id, ...form })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit goal"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!form.title.trim() || update.isPending}>Save</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex gap-3">
          <div className="w-16">
            <Label>Icon</Label>
            <Input value={form.emoji} onChange={(e) => set('emoji', e.target.value)} className="text-center" maxLength={2} />
          </div>
          <div className="flex-1">
            <Label>Title</Label>
            <Input value={form.title} onChange={(e) => set('title', e.target.value)} />
          </div>
          <div className="w-36">
            <Label>Category</Label>
            <Input value={form.category} onChange={(e) => set('category', e.target.value)} placeholder="career, skill…" />
          </div>
        </div>
        <div>
          <Label>Summary</Label>
          <Input value={form.summary} onChange={(e) => set('summary', e.target.value)} />
        </div>
        <div>
          <Label>Why it matters</Label>
          <Textarea value={form.why} onChange={(e) => set('why', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
