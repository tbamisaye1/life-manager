import { cn } from '../../lib/cn'

const TONES = {
  neutral: 'bg-zinc-100 text-zinc-600',
  accent: 'bg-accent-100 text-accent-700',
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  blue: 'bg-blue-100 text-blue-700',
}

export function Badge({ tone = 'neutral', className, ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium',
        TONES[tone],
        className,
      )}
      {...props}
    />
  )
}
