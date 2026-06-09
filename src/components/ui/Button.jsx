import { cn } from '../../lib/cn'

const VARIANTS = {
  primary: 'bg-accent-600 text-white hover:bg-accent-700 shadow-sm',
  secondary: 'bg-white text-zinc-700 border border-zinc-200 hover:bg-zinc-50 shadow-sm',
  ghost: 'text-zinc-600 hover:bg-zinc-100',
  danger: 'bg-white text-red-600 border border-red-200 hover:bg-red-50',
}

const SIZES = {
  sm: 'h-8 px-3 text-sm gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
  lg: 'h-10 px-5 text-base gap-2',
}

export function Button({ variant = 'secondary', size = 'md', className, type = 'button', ...props }) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center rounded-lg font-medium transition-colors',
        'focus-ring disabled:opacity-50 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
