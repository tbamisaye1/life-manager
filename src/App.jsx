import { Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import TodayPage from './pages/TodayPage'
import CalendarPage from './pages/CalendarPage'
import TasksPage from './pages/TasksPage'
import PrioritiesPage from './pages/PrioritiesPage'
import BoredPage from './pages/BoredPage'
import ImprovementsPage from './pages/ImprovementsPage'
import ImprovementDetailPage from './pages/ImprovementDetailPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import RugbyPage from './pages/RugbyPage'
import GymPage from './pages/GymPage'
import GymWorkoutPage from './pages/GymWorkoutPage'
import EmailPage from './pages/EmailPage'
import RepliesPage from './pages/RepliesPage'
import NotesPage from './pages/NotesPage'
import SettingsPage from './pages/SettingsPage'
import NotFoundPage from './pages/NotFoundPage'

function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route index element={<Navigate to="/today" replace />} />
        <Route path="/today" element={<TodayPage />} />
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/tasks" element={<TasksPage />} />
        <Route path="/priorities" element={<PrioritiesPage />} />
        <Route path="/bored" element={<BoredPage />} />
        <Route path="/improvements" element={<ImprovementsPage />} />
        <Route path="/improvements/:id" element={<ImprovementDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/rugby" element={<RugbyPage />} />
        <Route path="/gym" element={<GymPage />} />
        <Route path="/gym/workout/:id" element={<GymWorkoutPage />} />
        <Route path="/email" element={<EmailPage />} />
        <Route path="/replies" element={<RepliesPage />} />
        <Route path="/notes" element={<NotesPage />} />
        <Route path="/notes/:id" element={<NotesPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default App
