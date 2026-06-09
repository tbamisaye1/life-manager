import { cn } from '../../lib/cn'

/** Square icon-only button. Pass a lucide icon as children. */
export function IconButton({ className, label, active = false, ...props }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors focus-ring',
        active ? 'bg-zinc-200 text-zinc-900' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800',
        className,
      )}
      {...props}
    />
  )
}
