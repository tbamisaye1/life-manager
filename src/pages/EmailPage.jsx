import { Mail } from 'lucide-react'
import { PageHeader, Loading } from '../components/ui'

// Placeholder — built by the frontend-architect agent.
export default function EmailPage() {
  return (
    <div>
      <PageHeader title="Email" icon={Mail} />
      <Loading label="Email coming together…" />
    </div>
  )
}
