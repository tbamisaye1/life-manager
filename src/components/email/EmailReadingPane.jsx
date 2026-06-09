import { useState } from 'react'
import { Pin, MessageCircle, Mail } from 'lucide-react'
import { Card, CardBody, IconButton, Badge, Label, Textarea, Button, EmptyState } from '../ui'
import { cn } from '../../lib/cn'
import { formatDate, formatTime } from '../../lib/format'
import { emails as emailsResource } from '../../hooks/resources'

/**
 * Inner component that owns the reply-note state. Mounting a fresh instance
 * via key={email.id} in EmailReadingPane resets state without needing an
 * effect that calls setState.
 */
function ReplyNoteEditor({ email, update }) {
  const [replyNote, setReplyNote] = useState(email.reply_note ?? '')
  const [noteDirty, setNoteDirty] = useState(false)

  const handleNoteChange = (e) => {
    setReplyNote(e.target.value)
    setNoteDirty(true)
  }

  const saveNote = () => {
    if (!noteDirty) return
    update.mutate({ id: email.id, reply_note: replyNote })
    setNoteDirty(false)
  }

  return (
    <div className="border-t border-zinc-100 px-6 py-4">
      <Label htmlFor={`reply-note-${email.id}`}>What I want to say back</Label>
      <Textarea
        id={`reply-note-${email.id}`}
        value={replyNote}
        onChange={handleNoteChange}
        onBlur={saveNote}
        placeholder="Jot down a reply idea…"
        className="min-h-[72px]"
      />
      {noteDirty && (
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={saveNote}>
            Save note
          </Button>
        </div>
      )}
    </div>
  )
}

/** Full reading pane for a selected email with pin/needs-reply toggles and reply note. */
export function EmailReadingPane({ email }) {
  const update = emailsResource.useUpdate()

  if (!email) {
    return (
      <EmptyState
        icon={Mail}
        title="Select an email"
        description="Click any email on the left to read it here."
        className="h-full min-h-[320px]"
      />
    )
  }

  const handleTogglePin = () => {
    update.mutate({ id: email.id, pinned: !email.pinned })
  }

  const handleToggleNeedsReply = () => {
    update.mutate({ id: email.id, needs_reply: !email.needs_reply })
  }

  return (
    <Card className="flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 border-b border-zinc-100 px-6 py-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-zinc-900 leading-snug">
            {email.subject || '(no subject)'}
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            <span className="font-medium text-zinc-700">{email.from_name || email.from_email}</span>
            {email.from_name && (
              <span className="ml-1 text-zinc-400">&lt;{email.from_email}&gt;</span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            {formatDate(email.received_at, 'MMMM d, yyyy')} at {formatTime(email.received_at)}
          </p>
        </div>

        {/* Action toggles */}
        <div className="flex shrink-0 items-center gap-1">
          <IconButton
            label={email.needs_reply ? 'Remove needs-reply' : 'Mark needs reply'}
            active={email.needs_reply}
            onClick={handleToggleNeedsReply}
            className={cn(email.needs_reply && 'bg-amber-100 text-amber-700 hover:bg-amber-200')}
          >
            <MessageCircle className="h-4 w-4" />
          </IconButton>
          <IconButton
            label={email.pinned ? 'Unpin email' : 'Pin email'}
            active={email.pinned}
            onClick={handleTogglePin}
          >
            <Pin className={cn('h-4 w-4', email.pinned && 'fill-current')} />
          </IconButton>
        </div>
      </div>

      {/* Status badges */}
      {(email.needs_reply || email.pinned) && (
        <div className="flex items-center gap-2 border-b border-zinc-100 px-6 py-2">
          {email.pinned && <Badge tone="accent"><Pin className="h-3 w-3" /> Pinned</Badge>}
          {email.needs_reply && <Badge tone="amber"><MessageCircle className="h-3 w-3" /> Needs reply</Badge>}
        </div>
      )}

      {/* Body */}
      <CardBody className="flex-1 overflow-y-auto">
        <div className="whitespace-pre-wrap text-sm text-zinc-700 leading-relaxed">
          {email.body || email.snippet || '(no content)'}
        </div>
      </CardBody>

      {/* Reply note editor — keyed by email.id to reset state on email change */}
      <ReplyNoteEditor key={email.id} email={email} update={update} />
    </Card>
  )
}
