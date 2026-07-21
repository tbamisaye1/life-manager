import { useState, useRef, useEffect, useMemo } from 'react'
import { Bot, AlertCircle } from 'lucide-react'
import { NavPageHeader, Spinner } from '../components/ui'
import { ChatMessage } from '../components/assistant/ChatMessage'
import { ChatComposer } from '../components/assistant/ChatComposer'
import { ConversationList } from '../components/assistant/ConversationList'
import {
  useAssistantStatus,
  useConversation,
  useSendMessage,
} from '../hooks/useAssistant'

const EXAMPLE_PROMPTS = [
  'Schedule 30 min today to polish the Northstar landing page',
  'Remind me to email my PI tomorrow morning',
  'Find me time to go to the gym this afternoon',
  "Add 'read a paper on diffusion models' to my bored list",
]

export default function AssistantPage() {
  const { data: status } = useAssistantStatus()
  const sendMessage = useSendMessage()

  const [conversationId, setConversationId] = useState(null)
  const [optimistic, setOptimistic] = useState([])
  const [draft, setDraft] = useState('')
  const [editingMessageId, setEditingMessageId] = useState(null)
  const bottomRef = useRef(null)

  const { data: convData, isLoading: convLoading } = useConversation(conversationId)

  const messages = useMemo(
    () => (conversationId ? [...(convData?.messages ?? []), ...optimistic] : optimistic),
    [conversationId, convData, optimistic],
  )

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sendMessage.isPending])

  const handleSelectConversation = (id) => {
    setConversationId(id)
    setOptimistic([])
    setDraft('')
    setEditingMessageId(null)
  }

  const startEdit = (msg) => {
    if (sendMessage.isPending || !msg.id || msg.role !== 'user') return
    setEditingMessageId(msg.id)
    setDraft(msg.content)
    setOptimistic([])
  }

  const cancelEdit = () => {
    setEditingMessageId(null)
    setDraft('')
  }

  const stopRequest = async () => {
    await sendMessage.cancel(conversationId)
    setOptimistic([])
  }

  const send = (text) => {
    const content = (text ?? draft).trim()
    if (!content || sendMessage.isPending) return

    const editFromMessageId = editingMessageId || undefined

    if (editFromMessageId) {
      const idx = messages.findIndex((m) => m.id === editFromMessageId)
      const kept = idx >= 0 ? messages.slice(0, idx) : messages
      setOptimistic([...kept, { role: 'user', content, optimistic: true }])
    } else {
      setOptimistic([{ role: 'user', content, optimistic: true }])
    }

    setDraft('')
    setEditingMessageId(null)

    sendMessage.mutate(
      { conversationId, message: content, editFromMessageId },
      {
        onSuccess: (data) => {
          if (data.conversationId && data.conversationId !== conversationId) {
            setConversationId(data.conversationId)
          }
          setOptimistic([])
        },
        onError: (err) => {
          if (err.name === 'AbortError') {
            setOptimistic([])
            return
          }
          setOptimistic((prev) => [
            ...prev.filter((m) => !m.optimistic),
            {
              role: 'assistant',
              content: `Sorry, something went wrong. ${err.message}`,
              actions: [],
            },
          ])
        },
      },
    )
  }

  const notConfigured = status && status.configured === false
  const isEmpty = messages.length === 0 && !convLoading

  return (
    <div className="-mx-6 -my-8 flex h-[calc(100vh-4rem)] overflow-hidden">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white py-4 sm:flex">
        <ConversationList
          selectedId={conversationId}
          onSelect={handleSelectConversation}
        />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-6">
          <NavPageHeader
            path="/assistant"
            icon={Bot}
            subtitle="Reads your schedule and can create events, tasks, and reminders."
          />

          {notConfigured && (
            <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <span>
                No OpenAI API key found. Add{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">
                  OPENAI_API_KEY
                </code>{' '}
                to your{' '}
                <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env</code>{' '}
                file and restart the server to enable the assistant.
              </span>
            </div>
          )}

          <p className="mb-4 text-xs text-zinc-500">
            The assistant can read your schedule and make changes — review actions below each reply.
            Hover your messages to edit and resend; use Stop to cancel a request in progress.
          </p>

          <div className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
            {convLoading && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}

            {isEmpty && !convLoading && (
              <div className="flex flex-col items-start gap-2 pt-4">
                <p className="text-sm text-zinc-500">Try asking something like…</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => send(prompt)}
                      disabled={sendMessage.isPending}
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left text-sm text-zinc-600 shadow-sm transition-colors hover:border-accent-300 hover:bg-accent-50 hover:text-accent-700 disabled:pointer-events-none disabled:opacity-50"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <ChatMessage
                key={msg.id ?? `opt-${i}`}
                role={msg.role}
                content={msg.content}
                actions={msg.actions ?? []}
                canEdit={!sendMessage.isPending && !editingMessageId}
                onEdit={msg.role === 'user' && msg.id ? () => startEdit(msg) : undefined}
              />
            ))}

            {sendMessage.isPending && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Spinner />
                <span>Working…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div className="pt-3">
            <ChatComposer
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onSend={() => send()}
              onStop={stopRequest}
              onCancelEdit={cancelEdit}
              disabled={sendMessage.isPending}
              pending={sendMessage.isPending}
              editingLabel={
                editingMessageId
                  ? 'Editing message — send to resend from here (later replies will be removed)'
                  : null
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
