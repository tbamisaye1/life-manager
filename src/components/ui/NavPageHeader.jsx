import { EditableNavTitle } from './EditableNavTitle'
import { navMeta } from '../../lib/nav'

/** Page header with an inline-editable title that stays in sync with the sidebar. */
export function NavPageHeader({ path, subtitle, actions, icon }) {
  const meta = navMeta(path)
  const Icon = icon ?? meta?.icon
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {Icon && (
          <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
            <Icon className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">
            <EditableNavTitle
              path={path}
              className="block text-2xl font-bold tracking-tight"
              inputClassName="text-2xl font-bold tracking-tight px-1 py-0"
            />
          </h1>
          {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
