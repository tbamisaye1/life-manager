import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Target } from 'lucide-react'
import { Card, CardBody, Button, Input, Checkbox, ProgressBar, Badge, Loading, ErrorState, IconButton } from '../components/ui'
import { useImprovement, useImprovementActions } from '../hooks/useImprovement'
import { improvements as improvementsResource } from '../hooks/resources'

export default function ImprovementDetailPage() {
  const { id } = useParams()
  const { data: im, isLoading, isError, refetch } = useImprovement(id)
  const update = improvementsResource.useUpdate()
  const actions = useImprovementActions(id)
  const [newAction, setNewAction] = useState('')

  if (isLoading) return <Loading label="Loading goal…" />
  if (isError || !im) return <ErrorState message="Couldn't load this goal" onRetry={refetch} />

  const setProgress = (delta) => {
    const next = Math.max(0, Math.min(100, im.progress + delta))
    update.mutate({ id: im.id, progress: next })
  }

  const addAction = (e) => {
    e.preventDefault()
    if (!newAction.trim()) return
    actions.add.mutate(newAction.trim())
    setNewAction('')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Link to="/improvements" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 focus-ring">
        <ArrowLeft className="h-4 w-4" /> Improvements
      </Link>

      <div className="mb-6 flex items-start gap-3">
        <span className="text-4xl">{im.emoji}</span>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{im.title}</h1>
          {im.category && <Badge tone="accent" className="mt-1.5 capitalize">{im.category}</Badge>}
        </div>
      </div>

      {im.summary && <p className="mb-6 text-zinc-600">{im.summary}</p>}

      <Card className="mb-5">
        <CardBody>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700">Progress</span>
            <span className="text-sm text-zinc-500">{im.progress}%</span>
          </div>
          <ProgressBar value={im.progress} className="h-2" />
          <div className="mt-3 flex items-center gap-2">
            <Button size="sm" onClick={() => setProgress(-10)} disabled={im.progress <= 0}>-10%</Button>
            <span className="min-w-[3rem] text-center text-sm font-semibold text-zinc-700">{im.progress}%</span>
            <Button size="sm" onClick={() => setProgress(10)} disabled={im.progress >= 100}>+10%</Button>
          </div>
        </CardBody>
      </Card>

      {im.why && (
        <Card className="mb-5 border-accent-100 bg-accent-50/40">
          <CardBody>
            <p className="text-xs font-semibold uppercase tracking-wider text-accent-600">Why this matters</p>
            <p className="mt-1 text-sm text-zinc-600">{im.why}</p>
          </CardBody>
        </Card>
      )}

      <div className="mb-2 flex items-center gap-2 px-1">
        <Target className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-700">Action items</h2>
      </div>
      <Card className="overflow-hidden">
        <div className="divide-y divide-zinc-100">
          {im.actions.map((a) => (
            <div key={a.id} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-50">
              <Checkbox checked={a.done} onChange={() => actions.toggle.mutate({ actionId: a.id, done: !a.done })} label={a.text} />
              <span className={a.done ? 'flex-1 text-sm text-zinc-400 line-through' : 'flex-1 text-sm text-zinc-800'}>{a.text}</span>
              <IconButton label="Delete" onClick={() => actions.remove.mutate(a.id)} className="opacity-0 group-hover:opacity-100">
                <Trash2 className="h-3.5 w-3.5" />
              </IconButton>
            </div>
          ))}
        </div>
        <form onSubmit={addAction} className="flex gap-2 border-t border-zinc-100 p-3">
          <Input value={newAction} onChange={(e) => setNewAction(e.target.value)} placeholder="Add an action…" />
          <Button variant="primary" type="submit" disabled={!newAction.trim()}><Plus className="h-4 w-4" /></Button>
        </form>
      </Card>
    </div>
  )
}
