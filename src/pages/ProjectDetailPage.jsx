import { useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, CheckCircle2, Calendar, Pencil, Trash2 } from 'lucide-react'
import { Button, Card, Loading, ErrorState, EmptyState, IconButton } from '../components/ui'
import { ColorDot } from '../components/ui/ProjectTag'
import { TaskList } from '../components/tasks/TaskList'
import { TaskDetailModal } from '../components/tasks/TaskDetailModal'
import { ProjectEditModal } from '../components/projects/ProjectEditModal'
import { ScheduleItem } from '../components/today/ScheduleItem'
import { projects as projectsResource } from '../hooks/resources'
import { useToggleTask } from '../hooks/useTaskActions'
import { api } from '../lib/api'
import { formatDistanceToNow, parseISO } from 'date-fns'

export default function ProjectDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: project, isLoading, isError, refetch } = projectsResource.useItem(id)
  const [selected, setSelected] = useState(null)
  const [editing, setEditing] = useState(false)
  const toggle = useToggleTask()
  const remove = projectsResource.useRemove()
  const client = useQueryClient()
  const touch = useMutation({
    mutationFn: () => api.post(`/projects/${id}/touch`),
    onSuccess: () => client.invalidateQueries({ queryKey: ['projects'] }),
  })

  if (isLoading) return <Loading label="Loading project…" />
  if (isError || !project) return <ErrorState message="Couldn't load this project" onRetry={refetch} />

  const openTasks = (project.tasks || []).filter((t) => t.status !== 'done')
  const del = async () => {
    if (!window.confirm(`Delete “${project.name}”? Its tasks and events will be unlinked.`)) return
    await remove.mutateAsync(project.id)
    navigate('/projects')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/projects" className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-800 focus-ring">
        <ArrowLeft className="h-4 w-4" /> Projects & Jobs
      </Link>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="text-4xl">{project.emoji}</span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-900">{project.name}</h1>
            <div className="mt-1 flex items-center gap-1.5 text-sm text-zinc-400">
              <ColorDot color={project.color} />
              {project.last_worked_at ? `Last worked ${formatDistanceToNow(parseISO(project.last_worked_at), { addSuffix: true })}` : 'Not logged yet'}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <IconButton label="Edit project" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></IconButton>
          <IconButton label="Delete project" onClick={del}><Trash2 className="h-4 w-4" /></IconButton>
          <Button variant="primary" onClick={() => touch.mutate()} disabled={touch.isPending} className="ml-1">
            <CheckCircle2 className="h-4 w-4" /> Worked on this
          </Button>
        </div>
      </div>

      {project.description && <p className="mb-6 text-zinc-600">{project.description}</p>}

      <h2 className="mb-2 px-1 text-sm font-semibold text-zinc-700">Open tasks</h2>
      {openTasks.length === 0 ? (
        <EmptyState title="No open tasks" description="Nothing outstanding for this project." className="mb-6" />
      ) : (
        <div className="mb-6">
          <TaskList tasks={openTasks} onToggle={toggle} onOpen={setSelected} />
        </div>
      )}

      <div className="mb-2 flex items-center gap-2 px-1">
        <Calendar className="h-4 w-4 text-zinc-400" />
        <h2 className="text-sm font-semibold text-zinc-700">Recent & upcoming events</h2>
      </div>
      <Card className="overflow-hidden">
        {(project.events || []).length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-zinc-400">No events linked to this project</div>
        ) : (
          <div className="divide-y divide-zinc-100">
            {project.events.map((e) => <ScheduleItem key={e.id} event={e} />)}
          </div>
        )}
      </Card>

      <TaskDetailModal key={selected?.id} task={selected} open={!!selected} onClose={() => setSelected(null)} />
      <ProjectEditModal key={project.id} project={project} open={editing} onClose={() => setEditing(false)} />
    </div>
  )
}
