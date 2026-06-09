import { useState } from 'react'
import { Plus, TrendingUp } from 'lucide-react'
import { Card, Button, Input, Label, EmptyState } from '../ui'
import { useRugbySkills, useCreateSkill } from '../../hooks/useRugby'
import { SkillRow } from './SkillRow'

/** Skills card: lists all skills with ProgressBar + nudge, plus an inline add-skill form. */
export function SkillTracker() {
  const { data: skills = [], isLoading } = useRugbySkills()
  const createSkill = useCreateSkill()

  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [target, setTarget] = useState('7')

  const handleAdd = (e) => {
    e.preventDefault()
    if (!name.trim()) return
    createSkill.mutate(
      { name: name.trim(), current_level: 1, target_level: Number(target) || 7 },
      {
        onSuccess: () => {
          setName('')
          setTarget('7')
          setAdding(false)
        },
      },
    )
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Skills to improve</p>
        <Button size="sm" onClick={() => setAdding((v) => !v)}>
          <Plus className="h-3.5 w-3.5" /> Add skill
        </Button>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-zinc-400">Loading skills…</div>
        ) : skills.length === 0 && !adding ? (
          <EmptyState
            icon={TrendingUp}
            title="No skills tracked yet"
            description="Add skills you want to develop and track your progress."
          />
        ) : (
          <div className="divide-y divide-zinc-100">
            {skills.map((skill) => (
              <SkillRow key={skill.id} skill={skill} />
            ))}
          </div>
        )}

        {adding && (
          <form
            onSubmit={handleAdd}
            className="flex flex-col gap-3 border-t border-zinc-100 p-4"
          >
            <div className="flex gap-3">
              <div className="flex-1">
                <Label htmlFor="skill-name">Skill name</Label>
                <Input
                  id="skill-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Line-out throwing"
                  autoFocus
                />
              </div>
              <div className="w-24">
                <Label htmlFor="skill-target">Target (1–10)</Label>
                <Input
                  id="skill-target"
                  type="number"
                  min="1"
                  max="10"
                  value={target}
                  onChange={(e) => setTarget(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setAdding(false)
                  setName('')
                  setTarget('7')
                }}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                type="submit"
                disabled={!name.trim() || createSkill.isPending}
              >
                Save skill
              </Button>
            </div>
          </form>
        )}
      </Card>
    </div>
  )
}
