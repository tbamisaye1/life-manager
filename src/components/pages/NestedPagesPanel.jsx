import { Link, useNavigate } from 'react-router-dom'
import { FileText, Plus } from 'lucide-react'
import { Button } from '../ui'
import { usePagesByHost, useCreatePage } from '../../hooks/usePages'

/** Full Notion-style pages nested inside a task (or other host entity). */
export function NestedPagesPanel({ hostType, hostId, hostLabel }) {
  const navigate = useNavigate()
  const { data: pages = [], isLoading } = usePagesByHost(hostType, hostId)
  const createPage = useCreatePage()

  const addPage = async () => {
    const created = await createPage.mutateAsync({
      title: hostLabel ? `${hostLabel} notes` : 'Untitled',
      host_type: hostType,
      host_id: hostId,
    })
    navigate(`/notes/${created.id}`)
  }

  return (
    <div className="border-t border-zinc-100 pt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Pages in this task</p>
        <Button variant="ghost" size="sm" onClick={addPage} disabled={createPage.isPending} className="h-7 text-xs">
          <Plus className="h-3.5 w-3.5" /> Add page
        </Button>
      </div>
      {isLoading ? (
        <p className="text-xs text-zinc-400">Loading pages…</p>
      ) : pages.length === 0 ? (
        <p className="text-xs text-zinc-400">
          Like Notion — attach a full page to this task. It lives in Notes too and works the same everywhere.
        </p>
      ) : (
        <ul className="space-y-1">
          {pages.map((p) => (
            <li key={p.id}>
              <Link
                to={`/notes/${p.id}`}
                className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-zinc-700 hover:bg-zinc-50 focus-ring"
              >
                <span>{p.icon || '📄'}</span>
                <span className="truncate">{p.title || 'Untitled'}</span>
                <FileText className="ml-auto h-3.5 w-3.5 shrink-0 text-zinc-400" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
