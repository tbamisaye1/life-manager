import { useState } from 'react'
import { Plus, BookOpen } from 'lucide-react'
import { Card, CardBody, Button, EmptyState, Loading, ErrorState } from '../ui'
import { ExerciseRow } from './ExerciseRow'
import { ExerciseFormModal } from './ExerciseFormModal'
import { useExercises } from '../../hooks/useGym'

const CATEGORIES = ['strength', 'rehab', 'mobility', 'conditioning']

/** Exercise library grouped by category with add/edit modal. */
export function ExerciseLibrary() {
  const { data: exercises = [], isLoading, isError, refetch } = useExercises()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }

  const openEdit = (ex) => {
    setEditing(ex)
    setModalOpen(true)
  }

  const closeModal = () => {
    setModalOpen(false)
    setEditing(null)
  }

  if (isLoading) return <Loading label="Loading exercises…" />
  if (isError) return <ErrorState message="Couldn't load exercises" onRetry={refetch} />

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = exercises.filter((ex) => ex.category === cat && !ex.archived)
    if (items.length > 0) acc[cat] = items
    return acc
  }, {})

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">{exercises.filter((e) => !e.archived).length} exercises</p>
        <Button variant="primary" size="sm" onClick={openNew}>
          <Plus className="h-4 w-4" /> Add exercise
        </Button>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No exercises yet"
          description="Add your first exercise to build your library."
          action={
            <Button variant="primary" onClick={openNew}>
              <Plus className="h-4 w-4" /> Add exercise
            </Button>
          }
        />
      ) : (
        Object.entries(grouped).map(([category, items]) => (
          <div key={category}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </p>
            <Card>
              <CardBody className="p-0">
                {items.map((ex) => (
                  <ExerciseRow key={ex.id} exercise={ex} onEdit={openEdit} />
                ))}
              </CardBody>
            </Card>
          </div>
        ))
      )}

      <ExerciseFormModal
        key={`${modalOpen ? 'open' : 'closed'}-${editing?.id ?? 'new'}`}
        open={modalOpen}
        onClose={closeModal}
        exercise={editing}
      />
    </div>
  )
}
