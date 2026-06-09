import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'

/** Accessible round/square checkbox used across tasks, priorities, actions. */
export function Checkbox({ checked, onChange, className, round = false, label }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center border transition-colors focus-ring',
        round ? 'rounded-full' : 'rounded-[5px]',
        checked
          ? 'border-accent-600 bg-accent-600 text-white'
          : 'border-zinc-300 bg-white hover:border-accent-500',
        className,
      )}
    >
      {checked && <Check className="h-3 w-3" strokeWidth={3} />}
    </button>
  )
}
