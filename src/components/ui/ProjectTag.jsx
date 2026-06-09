import { cn } from '../../lib/cn'
import { colorClasses } from '../../lib/colors'

/** Small colored chip identifying a project/job. */
export function ProjectTag({ code, color = 'slate', emoji, className }) {
  if (!code) return null
  const { soft } = colorClasses(color)
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium', soft, className)}>
      {emoji && <span className="text-[11px] leading-none">{emoji}</span>}
      {code}
    </span>
  )
}

/** Just the colored dot — for dense lists. */
export function ColorDot({ color = 'slate', className }) {
  const { dot } = colorClasses(color)
  return <span className={cn('inline-block h-2 w-2 rounded-full', dot, className)} />
}
