import { useEffect, useState } from 'react'
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
  const [createError, setCreateError] = useState(null)
  const [addingParentId, setAddingParentId] = useState(null)

  // Open the first page when visiting /notes with no selection (especially on mobile where the tree is compact).
  useEffect(() => {
    if (id || isLoading || isError || pages.length === 0) return
    const firstRoot = pages.find((p) => !p.parent_id) || pages[0]
    if (firstRoot) navigate(`/notes/${firstRoot.id}`, { replace: true })
  }, [id, isLoading, isError, pages, navigate])

  if (isLoading) return <Loading label="Loading workspace…" />
  if (isError) return <ErrorState message="Couldn't load your pages" onRetry={refetch} />

  const tree = buildPageTree(pages)

  const addTop = async () => {
    setCreateError(null)
    try {
      const created = await createPage.mutateAsync({ title: 'Untitled' })
      navigate(`/notes/${created.id}`)
    } catch (err) {
      setCreateError(err.message || 'Could not create page')
    }
  }

  const addSub = async (parentId) => {
    setCreateError(null)
    setAddingParentId(parentId)
    try {
      const created = await createPage.mutateAsync({ parent_id: parentId, title: 'Untitled' })
      navigate(`/notes/${created.id}`)
    } catch (err) {
      setCreateError(err.message || 'Could not create subpage')
    } finally {
      setAddingParentId(null)
    }
  }

  const childPages = id ? pages.filter((p) => p.parent_id === id) : []

  return (
    <div className="grid h-[calc(100vh-8rem)] min-h-[420px] grid-cols-1 gap-4 md:grid-cols-[minmax(200px,240px)_1fr] md:gap-6">
      <aside className="flex min-h-0 max-h-[38vh] flex-col overflow-hidden border-b border-zinc-200 pb-3 md:max-h-none md:border-b-0 md:border-r md:pr-3">
        <PageTree
          tree={tree}
          onAddTop={addTop}
          onAddSub={addSub}
          creating={createPage.isPending && !addingParentId}
          addingParentId={addingParentId}
          createError={createError}
        />
      </aside>

      <div className="min-h-0 min-w-0">
        {pages.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Your notes workspace"
            description="Create a page to start. Pages can hold subpages, headings, checklists, and more."
            action={
              <Button variant="primary" onClick={addTop} disabled={createPage.isPending}>
                {createPage.isPending ? 'Creating…' : 'New page'}
              </Button>
            }
          />
        ) : !id ? (
          <Loading label="Opening page…" />
        ) : pageLoading ? (
          <Loading label="Opening page…" />
        ) : pageError || !page ? (
          <ErrorState message="That page no longer exists" onRetry={() => navigate('/notes')} />
        ) : (
          <PageView key={page.id} page={page} childPages={childPages} />
        )}
      </div>
    </div>
  )
}
