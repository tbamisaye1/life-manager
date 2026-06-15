import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { PageTreeItem } from './PageTreeItem'

/** The OneNote-style page sidebar: all top-level pages + their subpages. */
export function PageTree({ tree, onAddSub, onAddTop, creating, addingParentId, createError }) {
  return (
    <div className="flex h-full min-h-0 flex-col pt-1">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Pages</span>
      </div>

      <div className="-mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {tree.map((page) => (
          <PageTreeItem
            key={page.id}
            page={page}
            onAddSub={onAddSub}
            addingParentId={addingParentId}
          />
        ))}
      </div>

      {createError && (
        <p className="mt-2 px-1 text-xs text-red-600">{createError}</p>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onAddTop}
        disabled={creating}
        className="mt-2 w-full justify-start text-zinc-600"
      >
        <Plus className="h-4 w-4" />
        {creating ? 'Creating…' : 'New page'}
      </Button>
    </div>
  )
}
