import { useState } from 'react'
import { ListChecks, Plus } from 'lucide-react'
import { PageHeader, Button, Card, Input, Loading, ErrorState, EmptyState } from '../components/ui'
import { PriorityItem } from '../components/priorities/PriorityItem'
import { priorities as prioritiesResource, useCheckPriority } from '../hooks/resources'

export default function PrioritiesPage() {
  const { data: items = [], isLoading, isError, refetch } = prioritiesResource.useList()
  const check = useCheckPriority()
  const create = prioritiesResource.useCreate()
  const [adding, setAdding] = useState('')

  if (isLoading) return <Loading label="Loading priorities…" />
  if (isError) return <ErrorState message="Couldn't load priorities" onRetry={refetch} />

  const submit = (e) => {
    e.preventDefault()
    if (!adding.trim()) return
    create.mutate({ title: adding.trim(), cadence: 'daily' })
    setAdding('')
  }

  const daily = items.filter((p) => p.cadence === 'daily')
  const weekly = items.filter((p) => p.cadence === 'weekly')
  const doneCount = items.filter((p) => p.done_for_period).length

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Daily Priorities"
        subtitle={`The things you want to stay on top of — ${doneCount}/${items.length} done for now.`}
        icon={ListChecks}
      />

      <form onSubmit={submit} className="mb-5 flex gap-2">
        <Input value={adding} onChange={(e) => setAdding(e.target.value)} placeholder="Add a recurring priority…" />
        <Button variant="primary" type="submit" disabled={!adding.trim()}>
          <Plus className="h-4 w-4" /> Add
        </Button>
      </form>

      {items.length === 0 ? (
        <EmptyState icon={ListChecks} title="No priorities yet" description="Add things you want to check on regularly." />
      ) : (
        <div className="space-y-5">
          {daily.length > 0 && (
            <Group title="Every day">
              {daily.map((p) => <PriorityItem key={p.id} priority={p} onCheck={check.mutate} />)}
            </Group>
          )}
          {weekly.length > 0 && (
            <Group title="Every week">
              {weekly.map((p) => <PriorityItem key={p.id} priority={p} onCheck={check.mutate} />)}
            </Group>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ title, children }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</p>
      <Card className="overflow-hidden">
        <div className="divide-y divide-zinc-100">{children}</div>
      </Card>
    </div>
  )
}
