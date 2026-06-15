import { useState } from 'react'
import { Dumbbell, Plus, Calendar } from 'lucide-react'
import { NavPageHeader, Button, Card, CardBody, EmptyState, Loading, ErrorState } from '../components/ui'
import { useRugbySessions } from '../hooks/useRugby'
import { SkillTracker } from '../components/rugby/SkillTracker'
import { SessionCard } from '../components/rugby/SessionCard'
import { AddSessionModal } from '../components/rugby/AddSessionModal'
import { StatPill } from '../components/rugby/StatPill'

/** Summary strip — games played + avg rating. Only renders when there is data. */
function SummaryStrip({ sessions }) {
  if (!sessions.length) return null

  const games = sessions.filter((s) => s.type === 'game')
  const rated = sessions.filter((s) => s.rating != null)
  const avgRating =
    rated.length > 0
      ? (rated.reduce((sum, s) => sum + s.rating, 0) / rated.length).toFixed(1)
      : null

  return (
    <Card className="mb-6">
      <CardBody className="flex flex-wrap gap-4 p-4">
        <StatPill label="Sessions" value={sessions.length} />
        <StatPill label="Games" value={games.length} />
        <StatPill label="Training" value={sessions.length - games.length} />
        {avgRating && <StatPill label="Avg rating" value={`${avgRating}/10`} />}
      </CardBody>
    </Card>
  )
}

export default function RugbyPage() {
  const { data: sessions = [], isLoading, isError, refetch } = useRugbySessions()
  const [modalKey, setModalKey] = useState(0)
  const [showModal, setShowModal] = useState(false)

  const openModal = () => {
    setModalKey((k) => k + 1)
    setShowModal(true)
  }

  if (isLoading) return <Loading label="Loading rugby tracker…" />
  if (isError) return <ErrorState message="Couldn't load rugby data" onRetry={refetch} />

  return (
    <div className="mx-auto max-w-2xl">
      <NavPageHeader
        path="/rugby"
        subtitle="Track your performance, sessions, and skills."
        icon={Dumbbell}
        actions={
          <Button variant="primary" onClick={openModal}>
            <Plus className="h-4 w-4" /> Log session
          </Button>
        }
      />

      <SummaryStrip sessions={sessions} />

      {/* Skills section */}
      <div className="mb-8">
        <SkillTracker />
      </div>

      {/* Sessions section */}
      <div>
        <div className="mb-2 flex items-center justify-between px-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Session log</p>
        </div>

        {sessions.length === 0 ? (
          <EmptyState
            icon={Calendar}
            title="No sessions logged"
            description="Log your first game or training session to start tracking."
            action={
              <Button variant="primary" onClick={openModal}>
                <Plus className="h-4 w-4" /> Log session
              </Button>
            }
          />
        ) : (
          <div className="space-y-3">
            {sessions.map((session) => (
              <SessionCard key={session.id} session={session} />
            ))}
          </div>
        )}
      </div>

      <AddSessionModal key={modalKey} open={showModal} onClose={() => setShowModal(false)} />
    </div>
  )
}
