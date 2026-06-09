import { Router } from 'express'
import { db } from '../db/index.js'
import { newId, now } from '../lib/helpers.js'
import { runAssistant, assistantConfigured } from '../lib/assistant/index.js'
import { httpError } from '../lib/http.js'

const router = Router()

router.get('/status', (req, res) => {
  res.json({ configured: assistantConfigured() })
})

// ---- Conversation history (ChatGPT-style) ----
router.get('/conversations', async (req, res) => {
  const rows = await db.prepare('SELECT id, title, updated_at FROM chat_conversations ORDER BY updated_at DESC').all()
  res.json(rows)
})

router.get('/conversations/:id', async (req, res) => {
  const conversation = await db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(req.params.id)
  if (!conversation) return res.status(404).json(httpError('Conversation not found', 'NOT_FOUND'))
  const rows = await db.prepare('SELECT id, role, content, actions, created_at FROM chat_messages WHERE conversation_id = ? ORDER BY created_at').all(req.params.id)
  const messages = rows.map((m) => ({ ...m, actions: m.actions ? JSON.parse(m.actions) : [] }))
  res.json({ conversation, messages })
})

router.post('/conversations', async (req, res) => {
  const ts = now(); const id = newId()
  await db.prepare('INSERT INTO chat_conversations (id,title,created_at,updated_at) VALUES (?,?,?,?)')
    .run(id, req.body.title?.trim() || 'New chat', ts, ts)
  res.status(201).json(await db.prepare('SELECT id, title, updated_at FROM chat_conversations WHERE id = ?').get(id))
})

router.patch('/conversations/:id', async (req, res) => {
  if (req.body.title?.trim()) {
    await db.prepare('UPDATE chat_conversations SET title = ?, updated_at = ? WHERE id = ?')
      .run(req.body.title.trim(), now(), req.params.id)
  }
  res.json(await db.prepare('SELECT id, title, updated_at FROM chat_conversations WHERE id = ?').get(req.params.id))
})

router.delete('/conversations/:id', async (req, res) => {
  await db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(req.params.id)
  res.json({ ok: true })
})

// ---- Chat ----
// Persisted mode: { conversationId?, message }  → saves both turns, returns conversationId.
// Stateless mode: { messages: [...] }           → runs without saving (used by mobile).
router.post('/chat', async (req, res) => {
  const { conversationId, message, messages } = req.body

  if (typeof message === 'string' && message.trim()) {
    const ts = now()
    let convId = conversationId
    if (!convId) {
      convId = newId()
      const title = message.trim().slice(0, 48)
      await db.prepare('INSERT INTO chat_conversations (id,title,created_at,updated_at) VALUES (?,?,?,?)').run(convId, title, ts, ts)
    }
    const prior = await db.prepare('SELECT role, content FROM chat_messages WHERE conversation_id = ? ORDER BY created_at').all(convId)
    await db.prepare('INSERT INTO chat_messages (id,conversation_id,role,content,actions,created_at) VALUES (?,?,?,?,?,?)')
      .run(newId(), convId, 'user', message, null, now())

    const result = await runAssistant([...prior, { role: 'user', content: message }])

    await db.prepare('INSERT INTO chat_messages (id,conversation_id,role,content,actions,created_at) VALUES (?,?,?,?,?,?)')
      .run(newId(), convId, 'assistant', result.reply, JSON.stringify(result.actions || []), now())
    await db.prepare('UPDATE chat_conversations SET updated_at = ? WHERE id = ?').run(now(), convId)

    return res.json({ conversationId: convId, reply: result.reply, actions: result.actions, configured: result.configured })
  }

  if (Array.isArray(messages) && messages.length) {
    const history = messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: String(m.content || '') }))
    return res.json(await runAssistant(history))
  }

  return res.status(400).json(httpError('Provide `message` (with optional conversationId) or `messages`.', 'VALIDATION'))
})

export default router
