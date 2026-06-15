import { PageHeader } from './PageHeader'
import { navMeta } from '../../lib/nav'
import { useNavLabel } from '../../hooks/useNavLabels'

/** Page header that follows the user's custom sidebar name for a route. */
export function NavPageHeader({ path, subtitle, actions, icon }) {
  const title = useNavLabel(path)
  const meta = navMeta(path)
  const Icon = icon ?? meta?.icon
  return <PageHeader title={title} subtitle={subtitle} icon={Icon} actions={actions} />
}
