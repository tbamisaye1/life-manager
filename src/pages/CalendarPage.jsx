import { Calendar } from 'lucide-react'
import { PageHeader, Loading } from '../components/ui'

// Placeholder — built by the frontend-architect agent.
export default function CalendarPage() {
  return (
    <div>
      <PageHeader title="Calendar" icon={Calendar} />
      <Loading label="Calendar coming together…" />
    </div>
  )
}
