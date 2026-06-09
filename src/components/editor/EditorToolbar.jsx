import { Bold, Italic, Heading1, Heading2, List, ListOrdered, ListChecks, Quote, Code } from 'lucide-react'
import { cn } from '../../lib/cn'

// A flat formatting button. `active` highlights when the mark/node is applied.
function ToolBtn({ onClick, active, label, children }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-ring',
        active ? 'bg-accent-100 text-accent-700' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800',
      )}
    >
      {children}
    </button>
  )
}

/** Fixed formatting toolbar for the RichEditor (Notion-style block controls). */
export function EditorToolbar({ editor }) {
  if (!editor) return null
  const c = () => editor.chain().focus()
  return (
    <div className="sticky top-0 z-10 mb-2 flex flex-wrap items-center gap-0.5 border-b border-zinc-100 bg-white/90 py-1 backdrop-blur">
      <ToolBtn label="Heading 1" active={editor.isActive('heading', { level: 1 })} onClick={() => c().toggleHeading({ level: 1 }).run()}><Heading1 className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Heading 2" active={editor.isActive('heading', { level: 2 })} onClick={() => c().toggleHeading({ level: 2 }).run()}><Heading2 className="h-4 w-4" /></ToolBtn>
      <Divider />
      <ToolBtn label="Bold" active={editor.isActive('bold')} onClick={() => c().toggleBold().run()}><Bold className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Italic" active={editor.isActive('italic')} onClick={() => c().toggleItalic().run()}><Italic className="h-4 w-4" /></ToolBtn>
      <Divider />
      <ToolBtn label="Bulleted list" active={editor.isActive('bulletList')} onClick={() => c().toggleBulletList().run()}><List className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Numbered list" active={editor.isActive('orderedList')} onClick={() => c().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Checklist" active={editor.isActive('taskList')} onClick={() => c().toggleTaskList().run()}><ListChecks className="h-4 w-4" /></ToolBtn>
      <Divider />
      <ToolBtn label="Quote" active={editor.isActive('blockquote')} onClick={() => c().toggleBlockquote().run()}><Quote className="h-4 w-4" /></ToolBtn>
      <ToolBtn label="Code block" active={editor.isActive('codeBlock')} onClick={() => c().toggleCodeBlock().run()}><Code className="h-4 w-4" /></ToolBtn>
    </div>
  )
}

const Divider = () => <span className="mx-1 h-5 w-px bg-zinc-200" />
