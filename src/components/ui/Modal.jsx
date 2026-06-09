import { useEffect } from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from './IconButton'

/** Centered dialog with backdrop. Closes on Escape or backdrop click. */
export function Modal({ open, onClose, title, children, footer, className }) {
  useEffect(() => {
    if (!open) return
    const onKey = (e) => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-zinc-900/30 p-4 pt-[10vh] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className={cn('w-full max-w-lg rounded-2xl border border-zinc-200 bg-white shadow-xl', className)}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <IconButton label="Close" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-3">{footer}</div>}
      </div>
    </div>
  )
}
