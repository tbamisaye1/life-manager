import { useState } from 'react'
import { Modal, Button, Input, Textarea, Label } from '../ui'
import { cn } from '../../lib/cn'
import { PROJECT_COLORS, colorClasses } from '../../lib/colors'
import { projects as projectsResource } from '../../hooks/resources'

/** Edit a project's name, icon, color, short code, and description. */
export function ProjectEditModal({ project, open, onClose }) {
  const update = projectsResource.useUpdate()
  const [form, setForm] = useState({
    name: project?.name || '',
    emoji: project?.emoji || '📁',
    short_code: project?.short_code || '',
    color: project?.color || 'slate',
    description: project?.description || '',
  })
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    if (!form.name.trim()) return
    await update.mutateAsync({ id: project.id, ...form })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit project"
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={save} disabled={!form.name.trim() || update.isPending}>Save</Button>
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
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => set('name', e.target.value)} />
          </div>
          <div className="w-28">
            <Label>Code</Label>
            <Input value={form.short_code} onChange={(e) => set('short_code', e.target.value)} placeholder="ISPS" />
          </div>
        </div>
        <div>
          <Label>Color</Label>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={c}
                onClick={() => set('color', c)}
                className={cn('h-6 w-6 rounded-full ring-2 ring-offset-1 transition', colorClasses(c).dot, form.color === c ? 'ring-zinc-400' : 'ring-transparent')}
              />
            ))}
          </div>
        </div>
        <div>
          <Label>Description</Label>
          <Textarea value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
      </div>
    </Modal>
  )
}
