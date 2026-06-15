import { useState } from 'react'
import { Mail } from 'lucide-react'
import { NavPageHeader, Loading, ErrorState } from '../components/ui'
import { EmailFilters } from '../components/email/EmailFilters'
import { EmailList } from '../components/email/EmailList'
import { EmailReadingPane } from '../components/email/EmailReadingPane'
import { emails as emailsResource } from '../hooks/resources'

function emailCounts(emails) {
  return {
    all: emails.length,
    pinned: emails.filter((e) => e.pinned).length,
    needs_reply: emails.filter((e) => e.needs_reply).length,
    unread: emails.filter((e) => !e.is_read).length,
  }
}

export default function EmailPage() {
  const [filter, setFilter] = useState('all')
  const [selectedId, setSelectedId] = useState(null)

  // When filter is 'all' omit the param; otherwise pass it through
  const queryFilter = filter === 'all' ? undefined : filter
  const { data: emails = [], isLoading, isError, refetch } = emailsResource.useList(
    queryFilter ? { filter: queryFilter } : undefined,
  )
  // Counts always reflect the FULL inbox, regardless of the active filter.
  const { data: allEmails = [] } = emailsResource.useList()
  const update = emailsResource.useUpdate()

  if (isLoading) return <Loading label="Loading emails…" />
  if (isError) return <ErrorState message="Couldn't load emails" onRetry={refetch} />

  const counts = emailCounts(allEmails)
  const selectedEmail = emails.find((e) => e.id === selectedId) ?? null

  const handleSelect = (email) => {
    setSelectedId(email.id)
    if (!email.is_read) {
      update.mutate({ id: email.id, is_read: true })
    }
  }

  const handleTogglePin = (email) => {
    update.mutate({ id: email.id, pinned: !email.pinned })
  }

  return (
    <div>
      <NavPageHeader
        path="/email"
        subtitle="Your inbox at a glance — pin what matters, note what to reply."
        icon={Mail}
      />

      <div className="mb-4">
        <EmailFilters value={filter} onChange={setFilter} counts={counts} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(320px,380px)_1fr]">
        {/* Left: email list */}
        <div className="min-w-0">
          <EmailList
            emails={emails}
            selectedId={selectedId}
            onSelect={handleSelect}
            onTogglePin={handleTogglePin}
          />
        </div>

        {/* Right: reading pane (hidden on mobile when nothing selected) */}
        <div className={selectedEmail ? 'block' : 'hidden lg:block'}>
          <EmailReadingPane email={selectedEmail} />
        </div>
      </div>
    </div>
  )
}
