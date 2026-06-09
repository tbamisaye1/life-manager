import { useState } from 'react'
import { MessageSquare, Plus } from 'lucide-react'
import { PageHeader, Button, Card, Input, Select, Loading, ErrorState, EmptyState } from '../components/ui'
import { ReplyItem } from '../components/replies/ReplyItem'
import { PLATFORM_KEYS, platformMeta } from '../components/replies/platforms'
import { replyQueue as replyResource } from '../hooks/resources'

export default function RepliesPage() {
  const { data: replies = [], isLoading, isError, refetch } = replyResource.useList()
  const create = replyResource.useCreate()
  const update = replyResource.useUpdate()
  const remove = replyResource.useRemove()
  const [person, setPerson] = useState('')
  const [platform, setPlatform] = useState('imessage')

  if (isLoading) return <Loading label="Loading reply queue…" />
  if (isError) return <ErrorState message="Couldn't load replies" onRetry={refetch} />

  const submit = (e) => {
    e.preventDefault()
    if (!person.trim()) return
    create.mutate({ person: person.trim(), platform })
    setPerson('')
  }

  const open = replies.filter((r) => !r.done)
  const done = replies.filter((r) => r.done)
  const toggle = (r) => update.mutate({ id: r.id, done: !r.done })

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Reply Queue"
        subtitle="People you owe a message — across iMessage, WhatsApp, Instagram & more."
        icon={MessageSquare}
      />

      <form onSubmit={submit} className="mb-5 flex gap-2">
        <Input value={person} onChange={(e) => setPerson(e.target.value)} placeholder="Who do you need to reply to?" className="flex-1" />
        <Select value={platform} onChange={(e) => setPlatform(e.target.value)} className="w-36">
          {PLATFORM_KEYS.map((k) => <option key={k} value={k}>{platformMeta(k).label}</option>)}
        </Select>
        <Button variant="primary" type="submit" disabled={!person.trim()}><Plus className="h-4 w-4" /></Button>
      </form>

      {replies.length === 0 ? (
        <EmptyState icon={MessageSquare} title="Inbox zero on replies" description="Add someone when you remember you owe them a message." />
      ) : (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {open.map((r) => <ReplyItem key={r.id} reply={r} onToggle={toggle} onDelete={remove.mutate} />)}
              {open.length === 0 && <div className="px-3 py-6 text-center text-sm text-zinc-400">All caught up 🎉</div>}
            </div>
          </Card>

          {done.length > 0 && (
            <div>
              <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">Replied</p>
              <Card className="overflow-hidden opacity-70">
                <div className="divide-y divide-zinc-100">
                  {done.map((r) => <ReplyItem key={r.id} reply={r} onToggle={toggle} onDelete={remove.mutate} />)}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
