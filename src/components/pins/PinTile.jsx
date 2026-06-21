import { Pin, Trash2, Pencil } from 'lucide-react'
import { cn } from '../../lib/cn'
import { colorClasses } from '../../lib/colors'
import { pinAgeShort, pinTilt, linkParts } from '../../lib/pinUtils'
import { IconButton } from '../ui'

/** Compact sticky-note tile — scannable at a glance in the mosaic grid. */
export function PinTile({ pin, onEdit, onTogglePin, onDelete, compact = false }) {
  const { soft, ring } = colorClasses(pin.color)
  const tilt = pinTilt(pin.id)

  return (
    <div
      className={cn(
        'group relative transition duration-200 hover:-translate-y-0.5',
        compact ? 'min-w-[140px] max-w-[200px] shrink-0' : '',
      )}
      style={{ transform: `rotate(${tilt}deg)` }}
    >
      <article
        className={cn(
          'relative flex flex-col rounded-xl border border-black/[0.06] shadow-sm',
          'group-hover:shadow-md',
          soft,
          compact ? 'p-2.5' : 'p-3.5',
        )}
      >
      {pin.pinned && (
        <Pin className="absolute right-2 top-2 h-3 w-3 opacity-40" aria-hidden />
      )}

      <button
        type="button"
        onClick={() => onEdit(pin)}
        className="flex flex-1 flex-col text-left"
      >
        <p className={cn('leading-snug', compact ? 'line-clamp-3 text-xs' : 'line-clamp-5 text-sm')}>
          {linkParts(pin.body).map((part, i) =>
            part.type === 'url' ? (
              <a
                key={i}
                href={part.value}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                {part.value}
              </a>
            ) : (
              part.value
            ),
          )}
        </p>
        <span className={cn('mt-auto pt-1.5 font-medium tabular-nums opacity-45', compact ? 'text-[10px]' : 'text-[11px]')}>
          {pinAgeShort(pin.created_at)}
        </span>
      </button>

      <div
        className={cn(
          'absolute -right-1 -top-1 flex gap-0.5 rounded-lg bg-white/90 p-0.5 opacity-0 shadow-sm ring-1 backdrop-blur-sm transition',
          ring,
          'group-hover:opacity-100 group-focus-within:opacity-100',
        )}
      >
        <IconButton
          label={pin.pinned ? 'Unpin' : 'Pin'}
          className="h-7 w-7"
          onClick={() => onTogglePin(pin)}
        >
          <Pin className={cn('h-3.5 w-3.5', pin.pinned && 'fill-current')} />
        </IconButton>
        <IconButton label="Edit" className="h-7 w-7" onClick={() => onEdit(pin)}>
          <Pencil className="h-3.5 w-3.5" />
        </IconButton>
        <IconButton label="Delete" className="h-7 w-7 text-red-600" onClick={() => onDelete(pin)}>
          <Trash2 className="h-3.5 w-3.5" />
        </IconButton>
      </div>
      </article>
    </div>
  )
}
