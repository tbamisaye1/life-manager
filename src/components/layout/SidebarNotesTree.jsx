import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { usePages, buildPageTree, useCreatePage } from '../../hooks/usePages'
import { PageTreeRow } from './PageTreeRow'

/** Compact page tree nested under Notes & Ideas in the main sidebar. */
export function SidebarNotesTree() {
  const navigate = useNavigate()
  const { data: pages = [] } = usePages()
  const createPage = useCreatePage()
  const [addingParentId, setAddingParentId] = useState(null)
  const tree = buildPageTree(pages)

  const addSub = async (parentId) => {
    setAddingParentId(parentId)
    try {
      const created = await createPage.mutateAsync({ parent_id: parentId, title: 'Untitled' })
      navigate(`/notes/${created.id}`)
    } finally {
      setAddingParentId(null)
    }
  }

  const addTop = async () => {
    const created = await createPage.mutateAsync({ title: 'Untitled' })
    navigate(`/notes/${created.id}`)
  }

  if (tree.length === 0) {
    return (
      <button
        type="button"
        onClick={addTop}
        disabled={createPage.isPending}
        className="flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-200/40 hover:text-zinc-700"
      >
        <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        {createPage.isPending ? 'Creating…' : 'New page'}
      </button>
    )
  }

  return (
    <div className="max-h-[36vh] space-y-0.5 overflow-y-auto pb-0.5">
      {tree.map((page) => (
        <PageTreeRow
          key={page.id}
          page={page}
          onAddSub={addSub}
          addingParentId={addingParentId}
          compact
        />
      ))}
      <button
        type="button"
        onClick={addTop}
        disabled={createPage.isPending}
        className="mt-0.5 flex w-full items-center gap-1.5 rounded-md px-2 py-1 text-left text-[13px] text-zinc-500 transition-colors hover:bg-zinc-200/40 hover:text-zinc-700"
      >
        <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
        New page
      </button>
    </div>
  )
}
