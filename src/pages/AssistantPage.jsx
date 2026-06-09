import { useState, useRef, useEffect } from 'react'
import { Bot, AlertCircle } from 'lucide-react'
import { PageHeader, Spinner } from '../components/ui'
import { ChatMessage } from '../components/assistant/ChatMessage'
import { ChatComposer } from '../components/assistant/ChatComposer'
import { useAssistantStatus, useSendMessage } from '../hooks/useAssistant'

const EXAMPLE_PROMPTS = [
  'Schedule 30 min today to review my Rotunda deck',
  'Remind me to email my PI tomorrow morning',
  'Find me time to go to the gym this afternoon',
  "Add 'read a paper on diffusion models' to my bored list",
]

export default function AssistantPage() {
  const { data: status } = useAssistantStatus()
  const sendMessage = useSendMessage()

  const [messages, setMessages] = useState([])
  const [draft, setDraft] = useState('')
  const bottomRef = useRef(null)

  // Auto-scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sendMessage.isPending])

  const send = (text) => {
    const content = (text ?? draft).trim()
    if (!content) return

    const userMsg = { role: 'user', content }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setDraft('')

    // Send only role+content to the API (strip action metadata from prior turns)
    const payload = nextMessages.map(({ role, content: c }) => ({ role, content: c }))
    sendMessage.mutate(
      { messages: payload },
      {
        onSuccess: (data) => {
          setMessages((prev) => [
            ...prev,
            { role: 'assistant', content: data.reply, actions: data.actions ?? [] },
          ])
        },
        onError: (err) => {
          setMessages((prev) => [
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

  return (
    <div className="mx-auto flex h-[calc(100vh-6rem)] max-w-2xl flex-col">
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
            to your <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-xs">.env</code>{' '}
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
        {messages.length === 0 && (
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
          <ChatMessage key={i} role={msg.role} content={msg.content} actions={msg.actions} />
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
  )
}
