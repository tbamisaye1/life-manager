import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { EditorToolbar } from './EditorToolbar'

// Body is stored as TipTap JSON (stringified). Accept JSON string, object, or
// plain text (legacy notes) and coerce to something the editor can load.
function parseContent(value) {
  if (!value) return ''
  if (typeof value === 'object') return value
  try {
    const parsed = JSON.parse(value)
    return parsed
  } catch {
    return value // treat as plain text
  }
}

/**
 * Reusable Notion-style block editor. Used by the notes workspace and the
 * expandable detail bodies on priorities/Bored items.
 * Mount with a `key` tied to the record id so switching records re-seeds it.
 */
export function RichEditor({ value, onChange, placeholder = 'Start writing…', editable = true, toolbar = true }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: parseContent(value),
    editable,
    onUpdate: ({ editor }) => onChange?.(JSON.stringify(editor.getJSON())),
    editorProps: { attributes: { class: 'tiptap-content focus:outline-none' } },
  })

  if (!editor) return null

  return (
    <div>
      {toolbar && editable && <EditorToolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  )
}
