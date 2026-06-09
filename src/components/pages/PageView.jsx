import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Star, Trash2, Plus, ChevronRight, Check } from 'lucide-react'
import { cn } from '../../lib/cn'
import { IconButton } from '../ui/IconButton'
import { Button } from '../ui/Button'
import { RichEditor } from '../editor/RichEditor'
import { useUpdatePage, useDeletePage, useCreatePage } from '../../hooks/usePages'

/**
 * The editor pane for a single page. Autosaves title + body on a debounce and
 * flushes any pending change on unmount (e.g. when switching pages).
 * Mounted with `key={page.id}` so it re-seeds cleanly per page.
 */
export function PageView({ page }) {
  const navigate = useNavigate()
  const update = useUpdatePage()
  const remove = useDeletePage()
  const createPage = useCreatePage()

  const [title, setTitle] = useState(page.title)
  const [focus, setFocus] = useState(page.is_focus)

  const timer = useRef(null)
  const latest = useRef({ title: page.title, body: page.body, dirty: false })

  // Debounced autosave, with a guaranteed flush on unmount so a last edit made
  // just before switching pages is never lost.
  const doSave = () => {
    if (!latest.current.dirty) return
    update.mutate({ id: page.id, title: latest.current.title, body: latest.current.body })
    latest.current.dirty = false
  }
  const flushRef = useRef(doSave)
  useEffect(() => { flushRef.current = doSave })
  useEffect(() => () => { clearTimeout(timer.current); flushRef.current() }, [])

  const schedule = () => {
    clearTimeout(timer.current)
    timer.current = setTimeout(doSave, 700)
  }
  const onTitle = (v) => { setTitle(v); latest.current.title = v; latest.current.dirty = true; schedule() }
  const onBody = (v) => { latest.current.body = v; latest.current.dirty = true; schedule() }

  const toggleFocus = () => {
    const next = !focus
    setFocus(next)
    update.mutate({ id: page.id, is_focus: next })
  }

  const addSubpage = async () => {
    const created = await createPage.mutateAsync({ parent_id: page.id, title: 'Untitled' })
    navigate(`/notes/${created.id}`)
  }

  const del = async () => {
    await remove.mutateAsync(page.id)
    navigate('/notes')
  }

  return (
    <div className="flex h-full flex-col">
      {/* Breadcrumb + actions */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1 text-xs text-zinc-500">
          {page.breadcrumb?.map((b) => (
            <span key={b.id} className="flex items-center gap-1">
              <Link to={`/notes/${b.id}`} className="truncate hover:text-zinc-700 focus-ring rounded">{b.icon} {b.title}</Link>
              <ChevronRight className="h-3 w-3" />
            </span>
          ))}
          <span className="truncate text-zinc-700">{page.icon} {title || 'Untitled'}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="mr-1 text-xs text-zinc-400">{update.isPending ? 'Saving…' : <span className="inline-flex items-center gap-0.5 text-emerald-600"><Check className="h-3 w-3" />Saved</span>}</span>
          <IconButton label={focus ? 'Unflag focus' : 'Flag as focus (shows in Bored)'} active={focus} onClick={toggleFocus}>
            <Star className={cn('h-4 w-4', focus && 'fill-current text-amber-500')} />
          </IconButton>
          <IconButton label="Add subpage" onClick={addSubpage}><Plus className="h-4 w-4" /></IconButton>
          <IconButton label="Delete page" onClick={del}><Trash2 className="h-4 w-4" /></IconButton>
        </div>
      </div>

      {/* Title */}
      <div className="mb-2 flex min-w-0 items-center gap-2">
        <span className="text-3xl">{page.icon || '📄'}</span>
        <input
          value={title}
          onChange={(e) => onTitle(e.target.value)}
          placeholder="Untitled"
          className="w-full border-0 bg-transparent text-3xl font-bold tracking-tight text-zinc-900 placeholder:text-zinc-300 focus:outline-none"
        />
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto pb-10">
        <RichEditor value={page.body} onChange={onBody} placeholder="Start writing — headings, lists, checkboxes, code…" />
      </div>

      {focus && (
        <div className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">
          ⭐ Flagged as focus — this page shows up in your “I'm Bored” suggestions.
        </div>
      )}
      <div className="pt-2">
        <Button variant="ghost" size="sm" onClick={addSubpage} className="text-zinc-400">
          <Plus className="h-4 w-4" /> Add subpage
        </Button>
      </div>
    </div>
  )
}
