import { useState } from 'react'
import { Sparkles, Plus, Shuffle } from 'lucide-react'
import { Button, Card, Input, Loading, ErrorState, EmptyState, NavPageHeader } from '../components/ui'
import { BoredItemRow } from '../components/bored/BoredItemRow'
import { BoredItemModal } from '../components/bored/BoredItemModal'
import { FocusPageRow } from '../components/bored/FocusPageRow'
import { boredItems as boredResource, useFocusPages } from '../hooks/resources'
import { useUpdatePage } from '../hooks/usePages'

export default function BoredPage() {
  const { data: items = [], isLoading, isError, refetch } = boredResource.useList()
  const { data: bored } = useFocusPages()
  const create = boredResource.useCreate()
  const update = boredResource.useUpdate()
  const remove = boredResource.useRemove()
  const unflagPage = useUpdatePage()
  const [adding, setAdding] = useState('')
  const [editing, setEditing] = useState(undefined) // undefined=closed, null=new, obj=edit
  const [picked, setPicked] = useState(null)

  if (isLoading) return <Loading label="Loading your list…" />
  if (isError) return <ErrorState message="Couldn't load your list" onRetry={refetch} />

  const open = items.filter((i) => !i.done)
  const done = items.filter((i) => i.done)
  const focusPages = bored?.focusPages || []

  const submit = (e) => {
    e.preventDefault()
    if (!adding.trim()) return
    create.mutate({ title: adding.trim() })
    setAdding('')
  }
  const toggle = (i) => { if (picked === i.id) setPicked(null); update.mutate({ id: i.id, done: !i.done }) }
  const pickOne = () => {
    if (!open.length) return
    setPicked(open[Math.floor(Math.random() * open.length)].id)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <NavPageHeader
        path="/bored"
        subtitle="Your own list of things to come back to — learn, build, improve."
        icon={Sparkles}
        actions={open.length > 0 && (
          <Button onClick={pickOne}><Shuffle className="h-4 w-4" /> Pick one for me</Button>
        )}
      />

      <form onSubmit={submit} className="mb-5 flex gap-2">
        <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add something you want to do later…" />
        <Button variant="primary" type="submit" disabled={!adding.trim()}><Plus className="h-4 w-4" /> Add</Button>
      </form>

      {items.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Your list is empty"
          description="Add things you'd want to pick up when you have a free moment — “learn chess”, a side project, a skill to sharpen."
        />
      ) : (
        <div className="space-y-5">
          <Card className="overflow-hidden">
            <div className="divide-y divide-zinc-100">
              {open.map((i) => (
                <BoredItemRow key={i.id} item={i} onToggle={toggle} onOpen={setEditing} onDelete={remove.mutate} highlighted={picked === i.id} />
              ))}
              {open.length === 0 && <div className="px-3 py-6 text-center text-sm text-zinc-400">Everything's checked off 🎉</div>}
            </div>
          </Card>

          {done.length > 0 && (
            <div>
              <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Done</p>
              <Card className="overflow-hidden opacity-70">
                <div className="divide-y divide-zinc-100">
                  {done.map((i) => (
                    <BoredItemRow key={i.id} item={i} onToggle={toggle} onOpen={setEditing} onDelete={remove.mutate} />
                  ))}
                </div>
              </Card>
            </div>
          )}
        </div>
      )}

      {focusPages.length > 0 && (
        <div className="mt-8">
          <p className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">Flagged pages</p>
          <div className="space-y-2">
            {focusPages.map((p) => (
              <FocusPageRow
                key={p.id}
                page={p}
                onRemove={(id) => unflagPage.mutate({ id, is_focus: false })}
              />
            ))}
          </div>
        </div>
      )}

      <BoredItemModal
        key={editing === undefined ? 'closed' : editing?.id || 'new'}
        item={editing}
        open={editing !== undefined}
        onClose={() => setEditing(undefined)}
      />
    </div>
  )
}
