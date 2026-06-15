import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { QuickAdd } from '../shared/QuickAdd'
import { navMeta, resolveItemLabel } from '../../lib/nav'
import { useNavLabels } from '../../hooks/useNavLabels'
import { api } from '../../lib/api'

// App frame: sidebar + top bar + routed page. Also records "recents" on
// navigation and wires the ⌘K / "n" quick-add shortcut.
export function AppShell() {
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const { pathname } = useLocation()
  const { data: labels } = useNavLabels()

  useEffect(() => {
    const meta = navMeta(pathname)
    if (meta) {
      const label = resolveItemLabel(pathname, meta.label, labels)
      api.post('/favorites/recents', { path: pathname, label, icon: meta.icon?.displayName || 'FileText' }).catch(() => {})
      return
    }
    const noteMatch = pathname.match(/^\/notes\/([^/]+)$/)
    if (noteMatch) {
      api.get(`/pages/${noteMatch[1]}`)
        .then((p) => api.post('/favorites/recents', {
          path: pathname,
          label: p.title || 'Untitled',
          icon: 'FileText',
        }))
        .catch(() => {})
    }
  }, [pathname, labels])

  // Global shortcut: "n" opens quick add (ignored while typing).
  useEffect(() => {
    const onKey = (e) => {
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName) || e.target.isContentEditable
      if (!typing && e.key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setQuickAddOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen overflow-hidden bg-zinc-50">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onQuickAdd={() => setQuickAddOpen(true)} />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-6xl px-6 py-8">
            <Outlet />
          </div>
        </main>
      </div>
      <QuickAdd open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  )
}
