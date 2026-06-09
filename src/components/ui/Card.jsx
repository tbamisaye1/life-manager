import { cn } from '../../lib/cn'

/** Surface container with subtle border + shadow. */
export function Card({ className, interactive = false, ...props }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-zinc-200 bg-white',
        interactive && 'transition-shadow hover:shadow-md cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}

export function CardBody({ className, ...props }) {
  return <div className={cn('p-5', className)} {...props} />
}
