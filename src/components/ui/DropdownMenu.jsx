import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'

/** Lightweight Notion-style dropdown menu anchored to a trigger. */
export function DropdownMenu({ trigger, items, align = 'right', className }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => {
      if (!ref.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, setOpen])

  const run = (item) => {
    setOpen(false)
    item.onSelect?.()
  }

  return (
    <div className={cn('relative shrink-0', className)} ref={ref}>
      <div
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen(!open)
        }}
      >
        {trigger}
      </div>
      {open && (
        <div
          role="menu"
          className={cn(
            'absolute top-full z-50 mt-1 min-w-[172px] rounded-lg border border-zinc-200/90 bg-white py-1 shadow-md shadow-zinc-900/5',
            align === 'right' ? 'right-0' : 'left-0',
          )}
        >
          {items.map((item) => {
            if (item.type === 'separator') {
              return <div key={item.key} className="my-1 border-t border-zinc-100" />
            }
            return (
              <button
                key={item.key}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  if (!item.disabled) run(item)
                }}
                className={cn(
                  'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[13px] transition-colors',
                  item.danger
                    ? 'text-red-600 hover:bg-red-50/80 disabled:text-red-300'
                    : 'text-zinc-600 hover:bg-zinc-100/80 disabled:text-zinc-300',
                )}
              >
                {item.icon && <item.icon className="h-3.5 w-3.5 shrink-0 text-zinc-400" />}
                <span>{item.label}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
