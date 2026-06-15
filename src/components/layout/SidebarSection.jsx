import { SidebarEditableLabel } from './SidebarEditableLabel'

/** A labeled group of sidebar rows. Section headers are double-click to rename. */
export function SidebarSection({ label, onRenameLabel, children }) {
  return (
    <div className="px-2">
      {label && (
        <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {onRenameLabel ? (
            <SidebarEditableLabel
              value={label}
              onSave={onRenameLabel}
              uppercase
              className="inline-block max-w-full"
            />
          ) : (
            label
          )}
        </p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
