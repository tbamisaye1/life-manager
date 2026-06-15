import { useState } from 'react'
import { NavLink, useMatch } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { SidebarEditableLabel } from './SidebarEditableLabel'
import { SidebarRowMenu } from './SidebarRowMenu'

/** A single sidebar navigation row with optional ⋯ menu and inline rename. */
export function SidebarLink({
  to,
  icon: Icon,
  label,
  end = false,
  badge,
  onRename,
  onResetName,
  menuExtra = [],
  favved,
  onToggleFavorite,
  customNamed,
}) {
  const [editing, setEditing] = useState(false)
  const active = Boolean(useMatch({ path: to, end }))

  const menu = []
  if (onRename) menu.push({ key: 'rename', label: 'Rename', onSelect: () => setEditing(true) })
  if (onToggleFavorite) menu.push({
    key: 'favorite',
    label: favved ? 'Remove from favorites' : 'Add to favorites',
    onSelect: onToggleFavorite,
  })
  if (customNamed && onResetName) menu.push({ key: 'reset', label: 'Reset name', onSelect: onResetName })
  menu.push(...menuExtra)

  return (
    <NavLink
      to={to}
      end={end}
      onClick={(e) => editing && e.preventDefault()}
      className={({ isActive }) =>
        cn(
          'group relative flex items-center gap-2.5 rounded-lg py-1.5 pl-2.5 pr-8 text-sm font-medium transition-colors focus-ring',
          isActive ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:bg-zinc-200/50 hover:text-zinc-800',
        )
      }
    >
      {Icon && <Icon className="h-[18px] w-[18px] shrink-0" />}
      {onRename ? (
        <SidebarEditableLabel
          value={label}
          onSave={onRename}
          editing={editing}
          onEditingChange={setEditing}
          className="min-w-0 flex-1"
        />
      ) : (
        <span className="min-w-0 flex-1 truncate">{label}</span>
      )}
      {badge != null && badge > 0 && (
        <span className="mr-1 rounded-full bg-zinc-200/80 px-1.5 text-xs font-semibold text-zinc-600">
          {badge}
        </span>
      )}
      {menu.length > 0 && <SidebarRowMenu items={menu} visible={active || editing} />}
    </NavLink>
  )
}
