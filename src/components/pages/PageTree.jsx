import { Plus } from 'lucide-react'
import { Button } from '../ui/Button'
import { PageTreeItem } from './PageTreeItem'

/** The OneNote-style page sidebar: all top-level pages + their subpages. */
export function PageTree({ tree, onAddSub, onAddTop }) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-1 pb-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Pages</span>
      </div>

      <div className="-mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1">
        {tree.map((page) => (
          <PageTreeItem key={page.id} page={page} onAddSub={onAddSub} />
        ))}
      </div>

      <Button variant="ghost" size="sm" onClick={() => onAddTop()} className="mt-2 w-full justify-start text-zinc-500">
        <Plus className="h-4 w-4" /> New page
      </Button>
    </div>
  )
}
