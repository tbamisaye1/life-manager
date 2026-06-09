import { useState, useRef, useEffect, useMemo } from 'react'
import { Bot, AlertCircle } from 'lucide-react'
import { PageHeader, Spinner } from '../components/ui'
import { ChatMessage } from '../components/assistant/ChatMessage'
import { ChatComposer } from '../components/assistant/ChatComposer'
import { ConversationList } from '../components/assistant/ConversationList'
import {
  useAssistantStatus,
  useConversation,
  useSendMessage,
} from '../hooks/useAssistant'

const EXAMPLE_PROMPTS = [
  'Schedule 30 min today to review my Rotunda deck',
  'Remind me to email my PI tomorrow morning',
  'Find me time to go to the gym this afternoon',
  "Add 'read a paper on diffusion models' to my bored list",
]

export default function AssistantPage() {
  const { data: status } = useAssistantStatus()
  const sendMessage = useSendMessage()

  // null  → new / empty chat
  // id    → a persisted conversation
  const [conversationId, setConversationId] = useState(null)

  // Optimistic messages shown while the request is in flight
  // Format: [{ role, content, actions?, optimistic? }]
  const [optimistic, setOptimistic] = useState([])

  const [draft, setDraft] = useState('')
  const bottomRef = useRef(null)

  // Fetch messages for the selected conversation
  const { data: convData, isLoading: convLoading } = useConversation(conversationId)

  // Displayed messages = server messages + any optimistic overlay (stable ref)
  const messages = useMemo(
    () => (conversationId ? [...(convData?.messages ?? []), ...optimistic] : optimistic),
    [conversationId, convData, optimistic],
  )

  // Auto-scroll when messages change or while pending
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sendMessage.isPending])

  // When a conversation is selected from the list, clear the optimistic buffer
  const handleSelectConversation = (id) => {
    setConversationId(id)
    setOptimistic([])
    setDraft('')
  }

  const send = (text) => {
    const content = (text ?? draft).trim()
    if (!content || sendMessage.isPending) return

    // Show user bubble immediately
    setOptimistic([{ role: 'user', content, optimistic: true }])
    setDraft('')

    sendMessage.mutate(
      { conversationId, message: content },
      {
        onSuccess: (data) => {
          // Adopt the (possibly new) conversation id
          if (data.conversationId && data.conversationId !== conversationId) {
            setConversationId(data.conversationId)
          }
          // Clear optimistic — the real messages will be fetched via invalidation
          setOptimistic([])
        },
        onError: (err) => {
          setOptimistic((prev) => [
            ...prev,
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
    // Stretch to fill the AppShell content area; break out of the max-w-6xl
    // constraint by using negative margins so the two-pane layout feels full-width.
    <div className="-mx-6 -my-8 flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* ── Left panel: conversation history ───────────────────────── */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-200 bg-white py-4 sm:flex">
        <ConversationList
          selectedId={conversationId}
          onSelect={handleSelectConversation}
        />
      </aside>

      {/* ── Right panel: active chat ────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Inner content area with comfortable max width */}
        <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-6">
          <PageHeader
            title="Assistant"
            icon={Bot}
            subtitle="Reads your schedule and can create events, tasks, and reminders."
          />

          {/* Not-configured notice */}
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

          {/* Disclaimer */}
          <p className="mb-4 text-xs text-zinc-500">
            The assistant can read your schedule and make changes — review actions below each reply.
          </p>

          {/* Message list */}
          <div className="flex-1 space-y-4 overflow-y-auto pb-4 pr-1">
            {/* Loading skeleton for selected conversation */}
            {convLoading && (
              <div className="flex justify-center py-8">
                <Spinner />
              </div>
            )}

            {/* Empty state / example prompts */}
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

            {/* Messages */}
            {messages.map((msg, i) => (
              <ChatMessage
                key={msg.id ?? `opt-${i}`}
                role={msg.role}
                content={msg.content}
                actions={msg.actions ?? []}
              />
            ))}

            {/* Thinking indicator */}
            {sendMessage.isPending && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                <Spinner />
                <span>Working…</span>
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Composer */}
          <div className="pt-3">
            <ChatComposer
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onSend={() => send()}
              disabled={sendMessage.isPending}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
