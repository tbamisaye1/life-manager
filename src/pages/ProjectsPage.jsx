import { FolderKanban } from 'lucide-react'
import { PageHeader, Loading, ErrorState, EmptyState } from '../components/ui'
import { ProjectCard } from '../components/projects/ProjectCard'
import { projects as projectsResource } from '../hooks/resources'

export default function ProjectsPage() {
  const { data: projects = [], isLoading, isError, refetch } = projectsResource.useList()

  if (isLoading) return <Loading label="Loading projects…" />
  if (isError) return <ErrorState message="Couldn't load projects" onRetry={refetch} />

  return (
    <div>
      <PageHeader
        title="Projects & Jobs"
        subtitle="Everything you're juggling — and when you last moved each one forward."
        icon={FolderKanban}
      />

      {projects.length === 0 ? (
        <EmptyState icon={FolderKanban} title="No projects yet" />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => <ProjectCard key={p.id} project={p} />)}
        </div>
      )}
    </div>
  )
}
