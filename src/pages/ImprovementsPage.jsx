import { useState } from 'react'
import { TrendingUp, Plus } from 'lucide-react'
import { NavPageHeader, Button, Modal, Input, Textarea, Label, Loading, ErrorState, EmptyState } from '../components/ui'
import { ImprovementCard } from '../components/improvements/ImprovementCard'
import { improvements as improvementsResource } from '../hooks/resources'

export default function ImprovementsPage() {
  const { data: items = [], isLoading, isError, refetch } = improvementsResource.useList()
  const create = improvementsResource.useCreate()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState({ title: '', summary: '', why: '' })

  if (isLoading) return <Loading label="Loading goals…" />
  if (isError) return <ErrorState message="Couldn't load improvements" onRetry={refetch} />

  const submit = async () => {
    if (!form.title.trim()) return
    await create.mutateAsync(form)
    setForm({ title: '', summary: '', why: '' })
    setOpen(false)
  }

  return (
    <div>
      <NavPageHeader
        path="/improvements"
        subtitle="The things you're actively trying to get better at. Each has its own page."
        icon={TrendingUp}
        actions={<Button variant="primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New goal</Button>}
      />

      {items.length === 0 ? (
        <EmptyState icon={TrendingUp} title="No improvement goals yet" description="Add something you want to get better at."
          action={<Button variant="primary" onClick={() => setOpen(true)}>New goal</Button>} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((im) => <ImprovementCard key={im.id} improvement={im} />)}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New improvement goal"
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={submit} disabled={!form.title.trim()}>Create</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Become a stronger fundraiser" />
          </div>
          <div>
            <Label>Summary</Label>
            <Input value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="One line on what this is" />
          </div>
          <div>
            <Label>Why it matters</Label>
            <Textarea value={form.why} onChange={(e) => setForm({ ...form, why: e.target.value })} placeholder="Your motivation" />
          </div>
        </div>
      </Modal>
    </div>
  )
}
