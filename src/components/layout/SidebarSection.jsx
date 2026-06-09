/** A labeled group of sidebar rows. */
export function SidebarSection({ label, children }) {
  return (
    <div className="px-2">
      {label && (
        <p className="px-2.5 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
          {label}
        </p>
      )}
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}
