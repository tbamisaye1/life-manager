import { useState } from 'react'
import { Dumbbell, Calendar, CalendarDays, BookOpen, BarChart2 } from 'lucide-react'
import { PageHeader } from '../components/ui'
import { GymTabs } from '../components/gym/GymTabs'
import { GymTodayTab } from '../components/gym/GymTodayTab'
import { GymPlanTab } from '../components/gym/GymPlanTab'
import { ExerciseLibrary } from '../components/gym/ExerciseLibrary'
import { ExerciseProgress } from '../components/gym/ExerciseProgress'
import { GymCalendar } from '../components/gym/GymCalendar'

const TABS = [
  { key: 'today', label: 'Today', icon: Calendar },
  { key: 'calendar', label: 'Calendar', icon: CalendarDays },
  { key: 'plan', label: 'Plan', icon: Dumbbell },
  { key: 'exercises', label: 'Exercises', icon: BookOpen },
  { key: 'progress', label: 'Progress', icon: BarChart2 },
]

export default function GymPage() {
  const [tab, setTab] = useState('today')

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Gym & Rehab" subtitle="Track sessions, progress your lifts, stay consistent." icon={Dumbbell} />
      <GymTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'today' && <GymTodayTab />}
      {tab === 'calendar' && <GymCalendar />}
      {tab === 'plan' && <GymPlanTab />}
      {tab === 'exercises' && <ExerciseLibrary />}
      {tab === 'progress' && <ExerciseProgress />}
    </div>
  )
}
