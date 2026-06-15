import { PageTreeRow } from '../layout/PageTreeRow'

/** One row in the Notes page panel tree — delegates to shared PageTreeRow. */
export function PageTreeItem(props) {
  return <PageTreeRow {...props} />
}
