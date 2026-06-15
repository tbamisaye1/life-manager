import { MoreHorizontal } from 'lucide-react'
import { DropdownMenu } from '../ui/DropdownMenu'
import { cn } from '../../lib/cn'

/** Three-dot menu — hidden until row hover or active; does not shift layout. */
export function SidebarRowMenu({ items, className, visible = false }) {
  return (
    <DropdownMenu
      className={cn(
        'absolute right-0.5 top-1/2 z-10 -translate-y-1/2',
        visible
          ? 'opacity-100'
          : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-100',
        className,
      )}
      trigger={(
        <button
          type="button"
          aria-label="Options"
          className="inline-flex h-6 w-6 items-center justify-center rounded-md text-zinc-400 transition-colors hover:bg-zinc-200/80 hover:text-zinc-600"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      )}
      items={items}
    />
  )
}
