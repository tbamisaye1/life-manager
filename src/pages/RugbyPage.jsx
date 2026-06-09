import { Dumbbell } from 'lucide-react'
import { PageHeader, Loading } from '../components/ui'

// Placeholder — built by the frontend-architect agent.
export default function RugbyPage() {
  return (
    <div>
      <PageHeader title="Rugby" icon={Dumbbell} />
      <Loading label="Rugby tracker coming together…" />
    </div>
  )
}
