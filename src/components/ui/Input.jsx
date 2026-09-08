import { cn } from '../../lib/cn'

const baseField =
  'w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-800 ' +
  'placeholder:text-zinc-400 focus-ring focus:border-accent-500'

export function Input({ className, ...props }) {
  return <input className={cn(baseField, 'h-9', className)} {...props} />
}

export function Textarea({ className, ...props }) {
  return <textarea className={cn(baseField, 'min-h-[120px] resize-y', className)} {...props} />
}

export function Select({ className, children, ...props }) {
  return (
    <select className={cn(baseField, 'h-9 pr-8', className)} {...props}>
      {children}
    </select>
  )
}

export function Label({ className, ...props }) {
  return <label className={cn('mb-1.5 block text-xs font-medium text-zinc-500', className)} {...props} />
}
