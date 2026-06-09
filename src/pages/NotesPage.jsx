import { useParams, useNavigate } from 'react-router-dom'
import { FileText } from 'lucide-react'
import { Loading, ErrorState, EmptyState, Button } from '../components/ui'
import { PageTree } from '../components/pages/PageTree'
import { PageView } from '../components/pages/PageView'
import { usePages, usePage, buildPageTree, useCreatePage } from '../hooks/usePages'

export default function NotesPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: pages = [], isLoading, isError, refetch } = usePages()
  const { data: page, isLoading: pageLoading, isError: pageError } = usePage(id)
  const createPage = useCreatePage()

  if (isLoading) return <Loading label="Loading workspace…" />
  if (isError) return <ErrorState message="Couldn't load your pages" onRetry={refetch} />

  const tree = buildPageTree(pages)

  const addTop = async () => {
    const created = await createPage.mutateAsync({ title: 'Untitled' })
    navigate(`/notes/${created.id}`)
  }
  const addSub = async (parentId) => {
    const created = await createPage.mutateAsync({ parent_id: parentId, title: 'Untitled' })
    navigate(`/notes/${created.id}`)
  }

  return (
    <div className="grid h-[calc(100vh-8rem)] grid-cols-1 gap-6 md:grid-cols-[240px_1fr]">
      <aside className="hidden overflow-hidden border-r border-zinc-200 pr-3 md:block">
        <PageTree tree={tree} onAddTop={addTop} onAddSub={addSub} />
      </aside>

      <div className="min-w-0">
        {!id ? (
          <EmptyState
            icon={FileText}
            title="Your notes workspace"
            description="Pick a page on the left, or create one. Pages can hold subpages, headings, checklists, and more."
            action={<Button variant="primary" onClick={addTop}>New page</Button>}
          />
        ) : pageLoading ? (
          <Loading label="Opening page…" />
        ) : pageError || !page ? (
          <ErrorState message="That page no longer exists" onRetry={() => navigate('/notes')} />
        ) : (
          <PageView key={page.id} page={page} />
        )}
      </div>
    </div>
  )
}
