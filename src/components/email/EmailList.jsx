import { Mail } from 'lucide-react'
import { Card, EmptyState } from '../ui'
import { EmailListItem } from './EmailListItem'

/** Scrollable card containing all EmailListItem rows. */
export function EmailList({ emails, selectedId, onSelect, onTogglePin }) {
  if (emails.length === 0) {
    return (
      <EmptyState
        icon={Mail}
        title="No emails here"
        description="Try a different filter or check back later."
      />
    )
  }

  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-zinc-100">
        {emails.map((email) => (
          <EmailListItem
            key={email.id}
            email={email}
            selected={email.id === selectedId}
            onSelect={onSelect}
            onTogglePin={onTogglePin}
          />
        ))}
      </div>
    </Card>
  )
}
